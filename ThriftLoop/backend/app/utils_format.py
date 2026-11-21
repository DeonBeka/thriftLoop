def price_text(value: float) -> str:
    rounded = round(value, 2)
    return f"€{int(rounded)}" if rounded == int(rounded) else f"€{rounded:.2f}"
