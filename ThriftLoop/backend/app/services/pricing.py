"""ThriftLoop's fees and delivery prices. All money maths happens here, on the server.

- Delivery: free in Prishtina, €2.00 anywhere else in Kosovo, charged once per seller in a checkout
  (each seller delivers their own items). The buyer pays it.
- Commission: ThriftLoop keeps 10% of each item's price. It comes out of the seller's share; the buyer
  never pays it on top of the listed price.
- Delivery commission: ThriftLoop keeps 5% of each delivery fee; the rest goes to the seller who delivers.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

# Kosovo's municipalities (Albanian names), Prishtina first.
KOSOVO_CITIES: list[str] = [
    "Prishtina", "Deçan", "Dragash", "Drenas", "Ferizaj", "Fushë Kosova", "Gjakova", "Gjilan", "Graçanica",
    "Hani i Elezit", "Istog", "Junik", "Kaçanik", "Kamenica", "Klina", "Kllokot", "Leposaviq", "Lipjan",
    "Malisheva", "Mamusha", "Mitrovica", "Mitrovica e Veriut", "Novobërda", "Obiliq", "Partesh", "Peja",
    "Podujeva", "Prizren", "Rahovec", "Ranillug", "Shtërpca", "Shtime", "Skenderaj", "Suhareka", "Viti",
    "Vushtrri", "Zubin Potok", "Zveçan",
]
FREE_DELIVERY_CITY = "Prishtina"
DELIVERY_FEE = Decimal("2.00")
COMMISSION_RATE = Decimal("0.10")
DELIVERY_COMMISSION_RATE = Decimal("0.05")

_CITY_LOOKUP = {c.casefold(): c for c in KOSOVO_CITIES} | {"pristina": "Prishtina", "prishtinë": "Prishtina"}


def normalize_city(value: str) -> str | None:
    """'prishtina ' -> 'Prishtina'; None if it isn't a Kosovo municipality we deliver to."""
    return _CITY_LOOKUP.get(value.strip().casefold())


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def delivery_fee(city: str) -> float:
    return 0.0 if city == FREE_DELIVERY_CITY else float(DELIVERY_FEE)


@dataclass(frozen=True)
class OrderMoney:
    price: float  # item price the buyer pays
    delivery_fee: float  # delivery the buyer pays (0 for the 2nd+ item from the same seller)
    commission: float  # ThriftLoop's 10% of the item price (paid by the seller)
    delivery_commission: float  # ThriftLoop's 5% of the delivery fee
    seller_payout: float  # what the seller keeps

    @property
    def buyer_total(self) -> float:
        return _money(Decimal(str(self.price)) + Decimal(str(self.delivery_fee)))

    @property
    def platform_total(self) -> float:
        return _money(Decimal(str(self.commission)) + Decimal(str(self.delivery_commission)))


def order_money(price: float, fee: float) -> OrderMoney:
    p, d = Decimal(str(price)), Decimal(str(fee))
    commission = (p * COMMISSION_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    delivery_cut = (d * DELIVERY_COMMISSION_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return OrderMoney(
        price=_money(p),
        delivery_fee=_money(d),
        commission=_money(commission),
        delivery_commission=_money(delivery_cut),
        seller_payout=_money(p + d - commission - delivery_cut),
    )


def fees_per_item(seller_ids: list[int], city: str) -> list[float]:
    """Delivery for each item of a checkout, in order: charged on the first item of each seller only."""
    seen: set[int] = set()
    fees = []
    for seller_id in seller_ids:
        fees.append(0.0 if seller_id in seen else delivery_fee(city))
        seen.add(seller_id)
    return fees
