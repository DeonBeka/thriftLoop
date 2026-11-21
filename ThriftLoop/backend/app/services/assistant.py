"""ThriftLoop shopping assistant.

Turns a free-text request ("blue tops under 10 bucks") into structured search filters, then searches
the real listings. Claude only extracts filters - it never invents products, prices or availability;
every item shown comes from the database.

Engines:
  * "ai"    - Claude (when ANTHROPIC_API_KEY is set) with structured JSON output.
  * "rules" - a built-in parser for colours, categories, groups, sizes, conditions, prices and sorting.
              Used when no key is configured or the AI call fails, so the feature always works.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Literal

import anthropic
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import Product, User
from app.models.product import CATEGORIES, CATEGORY_GROUPS, CONDITIONS, SIZES
from app.services import gemini
from app.services.serializers import products_out
from app.utils_format import price_text

logger = logging.getLogger("thriftloop.assistant")

SortOption = Literal["relevance", "newest", "price_asc", "price_desc", "popular"]
GroupName = Literal["tops", "bottoms", "shoes", "accessories"]

# Canonical colour -> words that count as that colour in titles/descriptions.
COLORS: dict[str, list[str]] = {
    "black": ["black", "charcoal", "jet black"],
    "white": ["white", "ivory", "off-white", "off white"],
    "grey": ["grey", "gray", "marl", "silver", "heather"],
    "blue": ["blue", "navy", "denim", "indigo", "cobalt", "light wash", "light-wash", "mid-wash", "mid wash"],
    "green": ["green", "olive", "sage", "forest", "khaki", "mint", "emerald"],
    "red": ["red", "burgundy", "maroon", "crimson", "wine"],
    "brown": ["brown", "tan", "camel", "chocolate", "cognac", "chestnut"],
    "beige": ["beige", "cream", "sand", "taupe", "stone", "nude", "oatmeal"],
    "pink": ["pink", "rose", "blush"],
    "purple": ["purple", "violet", "lilac", "lavender", "plum"],
    "yellow": ["yellow", "mustard"],
    "orange": ["orange", "rust", "coral"],
}

GROUP_WORDS: dict[str, list[str]] = {
    "tops": ["top", "tops", "upper", "upperwear", "upper body"],
    "bottoms": ["bottom", "bottoms", "pants", "legwear", "pant"],
    "shoes": ["shoe", "shoes", "sneaker", "sneakers", "trainers", "trainer", "boot", "boots", "footwear",
              "heels", "loafers", "runners", "kicks"],
    "accessories": ["accessory", "accessories", "bag", "bags", "tote", "beanie", "hat", "hats", "cap", "caps",
                    "scarf", "belt", "purse", "backpack"],
}

CATEGORY_WORDS: dict[str, list[str]] = {
    "Hoodies": ["hoodie", "hoodies", "hoody", "sweatshirt", "sweatshirts", "jumper", "jumpers", "sweater",
                "sweaters", "crewneck", "pullover"],
    "T-shirts": ["t-shirt", "t-shirts", "tshirt", "tshirts", "tee", "tees", "shirt", "shirts", "long-sleeve"],
    "Jackets": ["jacket", "jackets", "coat", "coats", "puffer", "parka", "blazer", "windbreaker", "trucker"],
    "Jeans": ["jean", "jeans"],
    "Trousers": ["trouser", "trousers", "chino", "chinos", "cargo", "cargos", "slacks", "joggers", "linen pants"],
}

NUM = r"(\d+(?:[.,]\d{1,2})?)"
CUR = r"(?:€|eur|euros?|\$|usd|dollars?|bucks|e)?"


class SearchFilters(BaseModel):
    """What the shopper asked for. Every field optional; empty means 'any'."""

    colors: list[str] = Field(default_factory=list)
    groups: list[GroupName] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)
    min_price: float | None = None
    max_price: float | None = None
    keywords: list[str] = Field(default_factory=list)
    sort: SortOption = "relevance"

    def clean(self) -> "SearchFilters":
        """Drop anything outside the known vocabulary (defends against odd AI output)."""
        self.colors = [c for c in dict.fromkeys(c.lower() for c in self.colors) if c in COLORS]
        self.categories = [c for c in dict.fromkeys(self.categories) if c in CATEGORIES]
        # A specific category beats its broad group ("hoodies" shouldn't widen to all tops).
        self.groups = [g for g in dict.fromkeys(self.groups)
                       if not any(c in CATEGORY_GROUPS[g] for c in self.categories)]  # type: ignore[misc]
        self.sizes = [s for s in dict.fromkeys(self.sizes) if s in SIZES]
        self.conditions = [c for c in dict.fromkeys(self.conditions) if c in CONDITIONS]
        self.keywords = [k.lower().strip() for k in self.keywords if 2 <= len(k.strip()) <= 30][:6]
        if self.min_price is not None and self.min_price < 0:
            self.min_price = None
        if self.max_price is not None and self.max_price <= 0:
            self.max_price = None
        if self.min_price is not None and self.max_price is not None and self.min_price > self.max_price:
            self.min_price, self.max_price = self.max_price, self.min_price
        return self

    def has_item_type(self) -> bool:
        return bool(self.groups or self.categories)

    def is_empty(self) -> bool:
        return not (self.colors or self.groups or self.categories or self.sizes or self.conditions
                    or self.min_price is not None or self.max_price is not None or self.keywords)


# ---------------------------------------------------------------------------------------------
# Rule-based understanding
# ---------------------------------------------------------------------------------------------

def _has_word(text: str, phrase: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(phrase)}(?![\w-])", text) is not None


def _num(value: str) -> float:
    return float(value.replace(",", "."))


def parse_rules(message: str) -> SearchFilters:
    text = " " + message.lower().replace("’", "'") + " "
    f = SearchFilters()

    f.colors = [c for c, words in COLORS.items() if any(_has_word(text, w) for w in words)]
    # "denim" alone describes jeans/jackets, not necessarily a colour request, unless nothing else matched.
    if f.colors == ["blue"] and not any(_has_word(text, w) for w in COLORS["blue"] if w != "denim"):
        f.colors = []
        if not any(_has_word(text, w) for w in CATEGORY_WORDS["Jeans"]):
            f.keywords.append("denim")

    f.groups = [g for g, words in GROUP_WORDS.items() if any(_has_word(text, w) for w in words)]  # type: ignore[misc]
    f.categories = [c for c, words in CATEGORY_WORDS.items() if any(_has_word(text, w) for w in words)]
    # A specific category beats its broad group ("jeans" shouldn't widen to all bottoms).
    f.groups = [g for g in f.groups if not any(c in CATEGORY_GROUPS[g] for c in f.categories)]  # type: ignore[misc]

    # Sizes
    sizes: list[str] = []
    for m in re.finditer(r"\beu\s?(3[6-9]|4[0-6])\b", text):
        sizes.append(f"EU {m.group(1)}")
    for m in re.finditer(r"\bw\s?(2[68]|3[02468])\b", text):
        sizes.append(f"W{m.group(1)}")
    for m in re.finditer(r"\bsize\s+(xxs|xs|s|m|l|xl|xxl|\d{2})\b", text):
        token = m.group(1)
        if token.isdigit():
            if 36 <= int(token) <= 46:
                sizes.append(f"EU {token}")
            elif 26 <= int(token) <= 38:
                sizes.append(f"W{token}")
        else:
            sizes.append(token.upper())
    for token in ("xxs", "xs", "xl", "xxl"):
        if _has_word(text, token):
            sizes.append(token.upper())
    for word, size in (("extra large", "XL"), ("extra small", "XS"), ("small", "S"), ("medium", "M"), ("large", "L")):
        if _has_word(text, word) and not (word in ("large", "small") and _has_word(text, f"extra {word}")):
            sizes.append(size)
    if _has_word(text, "one size"):
        sizes.append("One size")
    f.sizes = list(dict.fromkeys(s for s in sizes if s in SIZES))

    # Condition
    if any(_has_word(text, w) for w in ("like new", "mint", "barely worn", "almost new", "worn once")):
        f.conditions.append("Like new")
    if any(_has_word(text, w) for w in ("new with tags", "nwt", "brand new", "unworn", "never worn", "with tags")):
        f.conditions.append("New with tags")
    if _has_word(text, "good condition"):
        f.conditions.append("Good")
    if _has_word(text, "fair condition"):
        f.conditions.append("Fair")

    # Prices
    between = re.search(rf"between\s*{CUR}\s*{NUM}\s*{CUR}\s*(?:and|-|to)\s*{CUR}\s*{NUM}", text)
    dash = re.search(rf"{CUR}\s*{NUM}\s*(?:-|to)\s*{CUR}\s*{NUM}\s*(?:€|eur|euros?|\$|bucks|dollars?)", text)
    if between or dash:
        m = between or dash
        f.min_price, f.max_price = _num(m.group(1)), _num(m.group(2))  # type: ignore[union-attr]
    else:
        under = re.search(
            rf"(?:under|below|less than|cheaper than|max(?:imum)?|up to|at most|no more than|<|within|budget(?: of)?|for)\s*{CUR}\s*{NUM}",
            text,
        )
        over = re.search(rf"(?:over|above|more than|at least|from|min(?:imum)?|>)\s*{CUR}\s*{NUM}", text)
        around = re.search(rf"(?:around|about|roughly|~)\s*{CUR}\s*{NUM}", text)
        if under:
            f.max_price = _num(under.group(1))
        if over:
            f.min_price = _num(over.group(1))
        if around and not (under or over):
            value = _num(around.group(1))
            f.min_price, f.max_price = round(value * 0.7, 2), round(value * 1.3, 2)
    if f.max_price is None and any(_has_word(text, w) for w in ("cheap", "affordable", "budget", "bargain", "inexpensive")):
        f.max_price = 20.0

    # Sorting
    if any(_has_word(text, w) for w in ("cheapest", "lowest price", "least expensive")):
        f.sort = "price_asc"
    elif any(_has_word(text, w) for w in ("most expensive", "premium", "highest price", "luxury")):
        f.sort = "price_desc"
    elif any(_has_word(text, w) for w in ("newest", "latest", "new arrivals", "just in", "recent", "new in")):
        f.sort = "newest"
    elif any(_has_word(text, w) for w in ("popular", "trending", "best", "most saved", "favourite", "favorite")):
        f.sort = "popular"

    # Style words that make good soft-ranking hints
    for word in ("vintage", "leather", "suede", "linen", "wool", "cotton", "striped", "graphic", "oversized",
                 "slim", "relaxed", "wide-leg", "wide leg", "cargo", "puffer", "denim", "knit", "corduroy",
                 "waxed", "running", "chelsea", "crossbody", "warm", "winter", "summer"):
        if _has_word(text, word) and word not in f.keywords:
            f.keywords.append(word)
    return f.clean()


FOLLOW_UP = re.compile(r"^\s*(and|also|what about|how about|only|just|in|with|but|maybe|now|cheaper|under|below|show)\b",
                       re.IGNORECASE)


def merge_follow_up(new: SearchFilters, previous: SearchFilters | None, message: str) -> SearchFilters:
    """'What about under 20?' keeps the previous request and only changes what was mentioned."""
    if previous is None:
        return new
    short = len(message.split()) <= 6
    if new.has_item_type() and not FOLLOW_UP.match(message):
        return new
    if not (FOLLOW_UP.match(message) or short):
        return new
    merged = previous.model_copy(deep=True)
    for field in ("colors", "groups", "categories", "sizes", "conditions", "keywords"):
        value = getattr(new, field)
        if value:
            setattr(merged, field, value)
    if new.min_price is not None or new.max_price is not None:
        merged.min_price, merged.max_price = new.min_price, new.max_price
    if new.sort != "relevance":
        merged.sort = new.sort
    return merged.clean()


# ---------------------------------------------------------------------------------------------
# Claude understanding (optional)
# ---------------------------------------------------------------------------------------------

SYSTEM_PROMPT = f"""You turn a shopper's message for ThriftLoop, a second-hand clothing marketplace, into search filters.

Return only the filters the shopper actually asked for; leave the rest empty or null.
- Prices are in euros. "10 bucks", "$10" or "10 dollars" all mean 10. "Under X" sets max_price; "over X" sets min_price.
- groups: "tops" = hoodies, t-shirts, jackets; "bottoms" = jeans, trousers, pants; "shoes"; "accessories" (bags, hats, beanies, caps).
  Use a group for broad words ("tops", "something for my legs"), a specific category for specific words ("hoodie").
- categories must be from: {", ".join(CATEGORIES)}.
- colors must be from: {", ".join(COLORS)}. Map shades to these (navy -> blue, olive -> green, cream -> beige).
- sizes must be from: {", ".join(SIZES)}. Map "small/medium/large" to S/M/L.
- conditions must be from: {", ".join(CONDITIONS)}.
- Turn needs and occasions into item types: "warm", "cosy", "for winter" -> categories Hoodies and Jackets;
  "for summer" -> T-shirts; "for running" or "to walk in" -> shoes. Vague budgets: "not too pricey"/"cheap" -> max_price 30.
- keywords: 0-4 short style or material words that help rank results (e.g. "vintage", "leather", "warm"). Never repeat colours or categories.
- sort: "price_asc" for cheapest, "price_desc" for most expensive, "newest" for latest, "popular" for trending, otherwise "relevance".
If PREVIOUS FILTERS are given and the new message is a follow-up (e.g. "what about under 20?"), return the full updated filters."""

FILTER_SCHEMA = {
    "type": "object",
    "properties": {
        "colors": {"type": "array", "items": {"type": "string", "enum": list(COLORS)}},
        "groups": {"type": "array", "items": {"type": "string", "enum": list(CATEGORY_GROUPS)}},
        "categories": {"type": "array", "items": {"type": "string", "enum": CATEGORIES}},
        "sizes": {"type": "array", "items": {"type": "string", "enum": SIZES}},
        "conditions": {"type": "array", "items": {"type": "string", "enum": CONDITIONS}},
        "min_price": {"anyOf": [{"type": "number"}, {"type": "null"}]},
        "max_price": {"anyOf": [{"type": "number"}, {"type": "null"}]},
        "keywords": {"type": "array", "items": {"type": "string"}},
        "sort": {"type": "string", "enum": ["relevance", "newest", "price_asc", "price_desc", "popular"]},
    },
    "required": ["colors", "groups", "categories", "sizes", "conditions", "min_price", "max_price", "keywords", "sort"],
    "additionalProperties": False,
}


def parse_with_ai(message: str, previous: SearchFilters | None) -> SearchFilters | None:
    """Ask the configured AI (Claude first, then Gemini) for filters. None = use the built-in parser."""
    content = message if previous is None else (
        f"PREVIOUS FILTERS: {previous.model_dump_json()}\n\nNEW MESSAGE: {message}"
    )
    if not settings.anthropic_api_key:
        if not gemini.enabled():
            return None
        result = gemini.generate_json(content, FILTER_SCHEMA, system=SYSTEM_PROMPT)
        try:
            return SearchFilters.model_validate(result).clean() if result is not None else None
        except ValidationError:
            logger.warning("Gemini returned unexpected filters; using rule-based parser")
            return None
    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=20.0, max_retries=1)
        response = client.beta.messages.create(
            model=settings.assistant_model,
            max_tokens=1024,
            # If the model declines, the API transparently retries on a fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            # Low effort keeps the reply fast; structured output guarantees valid JSON in our schema.
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": FILTER_SCHEMA}},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.RateLimitError:
        logger.warning("Assistant AI rate-limited; using rule-based parser")
        return None
    except anthropic.APIStatusError as exc:
        logger.warning("Assistant AI error %s; using rule-based parser", exc.status_code)
        return None
    except anthropic.APIConnectionError:
        logger.warning("Assistant AI unreachable; using rule-based parser")
        return None

    if response.stop_reason in ("refusal", "max_tokens"):
        return None
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        return SearchFilters.model_validate(json.loads(text)).clean()
    except (json.JSONDecodeError, ValidationError):
        logger.warning("Assistant AI returned unexpected output; using rule-based parser")
        return None


# ---------------------------------------------------------------------------------------------
# Search + reply
# ---------------------------------------------------------------------------------------------

def _photo_colors(product: Product) -> set[str]:
    return {c for c in (product.photo_colors or "").split(",") if c}


def _written_colors(product: Product) -> set[str]:
    text = f" {product.title} {product.description} ".lower()
    return {c for c, words in COLORS.items() if any(_has_word(text, w) for w in words)}


def _matches_color(product: Product, colors: list[str]) -> bool:
    """The seller's own words win; if they didn't name a colour, use the colour seen in the main photo."""
    if not colors:
        return True
    written = _written_colors(product)
    known = written if written else _photo_colors(product)
    return bool(known & set(colors))


def _keyword_score(product: Product, keywords: list[str]) -> int:
    text = f"{product.title} {product.description}".lower()
    return sum(2 if k in product.title.lower() else 1 for k in keywords if k in text)


def search(db: Session, f: SearchFilters, *, use_price: bool = True, use_color: bool = True, limit: int = 12) -> list[Product]:
    stmt = select(Product).where(Product.status == "active").options(
        selectinload(Product.images), selectinload(Product.seller), selectinload(Product.favorites)
    )
    categories = set(f.categories)
    for g in f.groups:
        categories |= set(CATEGORY_GROUPS[g])
    if categories:
        stmt = stmt.where(Product.category.in_(categories))
    if f.sizes:
        stmt = stmt.where(Product.size.in_(f.sizes))
    if f.conditions:
        stmt = stmt.where(Product.condition.in_(f.conditions))
    if use_price and f.min_price is not None:
        stmt = stmt.where(Product.price >= f.min_price)
    if use_price and f.max_price is not None:
        stmt = stmt.where(Product.price <= f.max_price)

    items = [p for p in db.scalars(stmt.limit(500)).all() if not use_color or _matches_color(p, f.colors)]
    if f.sort == "price_asc":
        items.sort(key=lambda p: (p.price, -p.id))
    elif f.sort == "price_desc":
        items.sort(key=lambda p: (-p.price, -p.id))
    elif f.sort == "newest":
        items.sort(key=lambda p: p.created_at, reverse=True)
    elif f.sort == "popular":
        items.sort(key=lambda p: (len(p.favorites), p.created_at), reverse=True)
    else:  # relevance: style keywords first, then newest
        items.sort(key=lambda p: (_keyword_score(p, f.keywords), p.created_at), reverse=True)
    return items[:limit]


def _item_noun(f: SearchFilters) -> str:
    if f.categories:
        names = [c.lower() for c in f.categories]
        return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " or " + names[-1]
    if f.groups:
        return " and ".join(f.groups)
    return "items"


def describe(f: SearchFilters, *, include_price: bool = True, include_color: bool = True) -> str:
    parts = []
    if include_color and f.colors:
        parts.append(" or ".join(f.colors))
    if f.conditions:
        parts.append(" / ".join(c.lower() for c in f.conditions))
    parts.append(_item_noun(f))
    text = " ".join(parts)
    if f.sizes:
        text += f" in size {' or '.join(f.sizes)}"
    if include_price:
        if f.min_price is not None and f.max_price is not None:
            text += f" between {price_text(f.min_price)} and {price_text(f.max_price)}"
        elif f.max_price is not None:
            text += f" under {price_text(f.max_price)}"
        elif f.min_price is not None:
            text += f" over {price_text(f.min_price)}"
    return text


def suggestions_for(f: SearchFilters) -> list[str]:
    s = []
    if f.max_price is not None:
        s.append(f"What about under {price_text(f.max_price * 2)}?")
    if f.colors:
        s.append(f"Show me any colour of {_item_noun(f)}")
    if not f.has_item_type():
        s.append("Show me tops under €20")
    s.extend(["Cheapest shoes", "Something warm for winter", "Black jeans size W30"])
    return list(dict.fromkeys(s))[:4]


def answer(db: Session, message: str, previous: SearchFilters | None, viewer: User | None) -> dict:
    ai = parse_with_ai(message, previous)
    if ai is not None:
        f, engine = ai, "ai"
    else:
        f, engine = merge_follow_up(parse_rules(message), previous, message), "rules"

    if f.is_empty():
        latest = search(db, SearchFilters(sort="popular"), limit=8)
        return {
            "reply": "I can help you find clothes. Try something like “blue tops under €10”, “black jeans size W30” "
                     "or “cheapest shoes”. Meanwhile, here’s what’s popular right now:",
            "filters": f, "summary": "", "relaxed": None, "engine": engine,
            "products": products_out(db, latest, viewer),
            "suggestions": ["Blue tops under €10", "Shoes under €50", "Something warm for winter", "Accessories under €15"],
        }

    summary = describe(f)
    found = search(db, f)
    relaxed = None
    if found:
        reply = f"Here {'is' if len(found) == 1 else 'are'} {len(found)} {summary} I found:"
    else:
        reply = f"I couldn’t find any {summary} right now."
        if f.min_price is not None or f.max_price is not None:
            closest = search(db, f.model_copy(update={"sort": "price_asc"}), use_price=False)
            if closest:
                relaxed = "price"
                found = closest
                reply += (f" The closest {describe(f, include_price=False)} start at "
                          f"{price_text(closest[0].price)}:")
        if not found and f.colors:
            other = search(db, f, use_color=False)
            if other:
                relaxed = "color"
                found = other
                reply += f" Here are {describe(f, include_color=False)} in other colours instead:"
        if not found:
            reply += " Try a different colour, size or a higher budget, or check back soon as new items arrive daily."

    return {
        "reply": reply,
        "filters": f,
        "summary": summary,
        "relaxed": relaxed,
        "engine": engine,
        "products": products_out(db, found, viewer),
        "suggestions": suggestions_for(f),
    }
