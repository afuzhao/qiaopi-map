"""
Shared place/country gazetteer and normalization for qiaopi metadata pipelines.
"""

from __future__ import annotations

import re
from typing import Any

# Canonical sending countries used by the map.
CANONICAL_SEND_COUNTRIES = frozenset(
    {
        "中国大陆",
        "泰国",
        "新加坡",
        "马来西亚",
        "香港",
        "印度尼西亚",
        "越南",
        "柬埔寨",
        "老挝",
        "文莱",
        "澳大利亚",
    }
)

# Counties / cities in Guangdong & Fujian (Chaoshan region) — longest first for regex.
RECV_LOCALITIES: tuple[str, ...] = tuple(
    sorted(
        (
            "潮汕",
            "潮安",
            "潮阳",
            "潮州",
            "澄海",
            "澄邑",
            "揭阳",
            "揭邑",
            "揭西",
            "饶平",
            "汕头",
            "普宁",
            "惠来",
            "丰顺",
            "大埔",
            "梅县",
            "广州",
            "江门",
            "庵埠",
            "浮洋",
            "陆丰",
            "龙门",
            "诏安",
            "晋江",
            "永春",
        ),
        key=len,
        reverse=True,
    )
)

_RECV_LOCALITY_ALT = "|".join(re.escape(x) for x in RECV_LOCALITIES)
RECV_PLACE_RE = re.compile(
    rf"(?:广东|福建|关东|港东)(?:{_RECV_LOCALITY_ALT})|"
    rf"广东(?:{_RECV_LOCALITY_ALT})|"
    rf"福建(?:{_RECV_LOCALITY_ALT})"
)

OVERSEAS_RECV_BAD_RE = re.compile(
    r"^(新加坡|泰国|马来西亚|印度尼西亚|印尼|越南|柬埔寨|老挝|文莱|澳大利亚|澳洲|香港|缅甸)([\u4e00-\u9fff]{1,4})$"
)

COUNTRY_ONLY_RECV = frozenset(
    {
        "马来西亚",
        "新加坡",
        "泰国",
        "印度尼西亚",
        "印尼",
        "越南",
        "柬埔寨",
        "老挝",
        "文莱",
        "澳大利亚",
        "澳洲",
        "香港",
        "缅甸",
    }
)

FAMILY_ROLE_TOKENS = frozenset(
    {"母亲", "父母", "妻子", "亲", "岳父母", "祖父", "伯母", "哥哥", "婆婆", "儿子", "其他", "父亲"}
)

# Chinese city / keyword → canonical sending country
CITY_TO_COUNTRY: dict[str, str] = {
    "新加坡": "新加坡",
    "singapore": "新加坡",
    "曼谷": "泰国",
    "bangkok": "泰国",
    "暹罗": "泰国",
    "吉隆坡": "马来西亚",
    "kuala lumpur": "马来西亚",
    "槟城": "马来西亚",
    "梹城": "马来西亚",
    "penang": "马来西亚",
    "古晋": "马来西亚",
    "kuching": "马来西亚",
    "砂朥越": "马来西亚",
    "砂捞越": "马来西亚",
    "沙捞越": "马来西亚",
    "sarawak": "马来西亚",
    "麻坡": "马来西亚",
    "新山": "马来西亚",
    "怡保": "马来西亚",
    "芙蓉": "马来西亚",
    "关丹": "马来西亚",
    "峇株吧辖": "马来西亚",
    "山打根": "马来西亚",
    "sandakan": "马来西亚",
    "香港": "香港",
    "hong kong": "香港",
    "hongkong": "香港",
    "雅加达": "印度尼西亚",
    "jakarta": "印度尼西亚",
    "坤甸": "印度尼西亚",
    "占碑": "印度尼西亚",
    "jambi": "印度尼西亚",
    "万象": "老挝",
    "金边": "柬埔寨",
    "斯里巴加湾": "文莱",
    "悉尼": "澳大利亚",
    "汕头": "中国大陆",
    "shantou": "中国大陆",
    "潮州": "中国大陆",
    "潮安": "中国大陆",
    "澄海": "中国大陆",
    "揭阳": "中国大陆",
}

COUNTRY_ALIASES: dict[str, str] = {
    "中国": "中国大陆",
    "中国大陆": "中国大陆",
    "中国内地": "中国大陆",
    "内地": "中国大陆",
    "mainlandchina": "中国大陆",
    "泰": "泰国",
    "暹罗": "泰国",
    "thai": "泰国",
    "thailand": "泰国",
    "siam": "泰国",
    "星加坡": "新加坡",
    "新嘉坡": "新加坡",
    "singapore": "新加坡",
    "马来亚": "马来西亚",
    "马来": "马来西亚",
    "malaysia": "马来西亚",
    "malaya": "马来西亚",
    "hong kong": "香港",
    "hongkong": "香港",
    "印尼": "印度尼西亚",
    "indonesia": "印度尼西亚",
    "vietnam": "越南",
    "寮国": "老挝",
    "laos": "老挝",
    "brunei": "文莱",
    "australia": "澳大利亚",
}

# Bureau text hints → country (checked in order via first match in combined blob)
BUREAU_COUNTRY_HINTS: list[tuple[str, str]] = [
    ("槟城", "马来西亚"),
    ("梹城", "马来西亚"),
    ("吉隆坡", "马来西亚"),
    ("柔佛", "马来西亚"),
    ("麻坡", "马来西亚"),
    ("古晋", "马来西亚"),
    ("砂朥越", "马来西亚"),
    ("砂捞越", "马来西亚"),
    ("沙捞越", "马来西亚"),
    ("新嘉坡", "新加坡"),
    ("新加坡", "新加坡"),
    ("星洲", "新加坡"),
    ("实叻", "新加坡"),
    ("暹京", "泰国"),
    ("泰京", "泰国"),
    ("曼谷", "泰国"),
    ("汕头市", "中国大陆"),
    ("汕头", "中国大陆"),
    ("潮州", "中国大陆"),
    ("潮安", "中国大陆"),
    ("澄海", "中国大陆"),
    ("揭阳", "中国大陆"),
    ("福建", "中国大陆"),
    ("广东", "中国大陆"),
    ("香港", "香港"),
]

# Recipient coords: specific Chaoshan places BEFORE bare country names.
RECV_COORD_RULES: list[tuple[str, float, float]] = [
    ("广东汕头", 23.3541, 116.6820),
    ("广东揭西", 23.4314, 115.8381),
    ("广东揭邑", 23.5497, 116.3728),
    ("广东揭阳", 23.5497, 116.3728),
    ("广东潮阳", 23.2643, 116.6016),
    ("广东潮州", 23.6561, 116.6226),
    ("广东潮安", 23.4680, 116.6780),
    ("广东澄海", 23.4680, 116.7560),
    ("广东澄邑", 23.4680, 116.7560),
    ("广东饶平", 23.6638, 117.0040),
    ("广东普宁", 23.2973, 116.1582),
    ("广东丰顺", 23.7394, 116.1820),
    ("广东惠来", 23.0333, 116.2950),
    ("广东大埔", 24.3477, 116.6952),
    ("广东梅县", 24.3116, 116.0824),
    ("广东广州", 23.1291, 113.2644),
    ("广东江门", 22.5787, 113.0817),
    ("广东庵埠", 23.4500, 116.6800),
    ("广东浮洋", 23.5200, 116.6500),
    ("广东陆丰", 22.9192, 115.6403),
    ("广东龙门", 23.7276, 114.2594),
    ("福建诏安", 23.7112, 117.1751),
    ("福建晋江", 24.7814, 118.5517),
    ("福建永春", 25.3218, 118.2940),
    ("广东潮汕", 23.5000, 116.6500),
    ("关东潮安", 23.4680, 116.6780),
    ("关东澄海", 23.4680, 116.7560),
    ("港东潮安", 23.4680, 116.6780),
    ("潮汕", 23.5000, 116.6500),
    ("潮州", 23.6561, 116.6226),
    ("潮安", 23.4680, 116.6780),
    ("澄海", 23.4680, 116.7560),
    ("饶平", 23.6638, 117.0040),
    ("丰顺", 23.7394, 116.1820),
    ("揭阳", 23.5497, 116.3728),
    ("普宁", 23.2973, 116.1582),
    ("汕头", 23.3541, 116.6820),
    ("广丰顺", 23.7394, 116.1820),
    ("广澄海", 23.4680, 116.7560),
    ("新加坡", 1.3521, 103.8198),
    ("泰国", 13.7563, 100.5018),
    ("马来西亚", 3.1390, 101.6869),
    ("缅甸", 16.8661, 96.1951),
    ("印度尼西", -6.2088, 106.8456),
    ("香港", 22.3193, 114.1694),
]


def clean_field_text(v: object) -> str:
    s = str(v or "").strip()
    if not s:
        return ""
    s = re.sub(r"_x000D_", "", s, flags=re.IGNORECASE)
    s = s.replace("\r", "").replace("\n", " ")
    return s.strip()


def normalize_country_name(raw: object) -> str:
    text = clean_field_text(raw)
    if not text:
        return ""
    compact = re.sub(r"\s+", "", text)
    low = compact.lower()
    if low in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[low]
    if compact in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[compact]
    if compact in CANONICAL_SEND_COUNTRIES:
        return compact
    for canon in CANONICAL_SEND_COUNTRIES:
        if canon in compact or canon in text:
            return canon
    if compact in FAMILY_ROLE_TOKENS:
        return ""
    if re.fullmatch(r"[\u4e00-\u9fff]{2,8}", compact) and any(
        x in compact for x in ("潮安", "澄海", "揭阳", "饶平", "汕头", "广东", "福建")
    ):
        return "中国大陆"
    return compact


def is_valid_receiving_place(place: str) -> bool:
    p = clean_field_text(place)
    if not p or p in FAMILY_ROLE_TOKENS:
        return False
    if p in COUNTRY_ONLY_RECV:
        return False
    if OVERSEAS_RECV_BAD_RE.match(p):
        return False
    if RECV_PLACE_RE.search(p):
        return True
    if p.startswith("广东") or p.startswith("福建"):
        return True
    return False


def parse_receiving_place(after_ji: str) -> tuple[str, str]:
    """
    Parse (收批地, 收批人) from the substring after the first 寄 in DCTITLE.
    """
    after = clean_field_text(after_ji)
    if not after:
        return "", ""

    m = RECV_PLACE_RE.search(after)
    if m:
        place = m.group(0)
        # Normalize typo prefixes
        if place.startswith("关东"):
            place = "广东" + place[2:]
        elif place.startswith("港东"):
            place = "广东" + place[2:]
        recipient = after[m.end() :].strip()
        return place, recipient

    # Legacy 4-char slice when it looks like a valid place
    legacy_place = after[:4]
    legacy_recipient = after[4:].strip()
    if is_valid_receiving_place(legacy_place):
        return legacy_place, legacy_recipient

    # Search for 广东/福建 + locality anywhere in `after`
    for prefix in ("广东", "福建"):
        idx = after.find(prefix)
        if idx < 0:
            continue
        tail = after[idx:]
        m2 = RECV_PLACE_RE.search(tail)
        if m2:
            place = m2.group(0)
            if place.startswith("关东"):
                place = "广东" + place[2:]
            elif place.startswith("港东"):
                place = "广东" + place[2:]
            recipient = (after[:idx] + tail[m2.end() :]).strip()
            return place, recipient

    return legacy_place, legacy_recipient


def normalize_receiving_place(raw: object) -> str:
    place = clean_field_text(raw)
    if not place:
        return ""
    if is_valid_receiving_place(place):
        m = RECV_PLACE_RE.search(place)
        if m:
            p = m.group(0)
            if p.startswith("关东"):
                return "广东" + p[2:]
            if p.startswith("港东"):
                return "广东" + p[2:]
            return p
        return place
    # Try to salvage embedded place
    m = RECV_PLACE_RE.search(place)
    if m:
        p = m.group(0)
        if p.startswith("关东"):
            return "广东" + p[2:]
        if p.startswith("港东"):
            return "广东" + p[2:]
        return p
    return ""


def infer_country_from_hints(
    *,
    country_raw: str = "",
    city_zh: str = "",
    city_en: str = "",
    bureau: str = "",
) -> str:
    """Infer sending country; city and bureau override noisy country field."""
    for field in (city_zh, city_en):
        f = clean_field_text(field)
        if not f:
            continue
        if f in CITY_TO_COUNTRY:
            return CITY_TO_COUNTRY[f]
        low = f.lower()
        if low in CITY_TO_COUNTRY:
            return CITY_TO_COUNTRY[low]

    blob_compact = re.sub(r"\s+", "", f"{bureau} {city_zh} {city_en}")

    for needle, country in BUREAU_COUNTRY_HINTS:
        if needle in blob_compact:
            return country

    blob = f"{bureau} {city_zh} {city_en} {country_raw}"
    for key, country in sorted(CITY_TO_COUNTRY.items(), key=lambda kv: len(kv[0]), reverse=True):
        if key in blob or key.lower() in blob.lower():
            return country

    normalized = normalize_country_name(country_raw)
    if normalized in CANONICAL_SEND_COUNTRIES:
        return normalized
    return normalized


def lookup_recv_coords(place: object) -> tuple[float | None, float | None]:
    if place is None:
        return None, None
    s = clean_field_text(place)
    if not s:
        return None, None
    s = re.sub(r"\s+", "", s)
    for needle, lat, lng in RECV_COORD_RULES:
        if needle in s:
            return lat, lng
    return None, None


def fix_letter_row(row: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of row with normalized location fields."""
    out = dict(row)
    recv_raw = clean_field_text(out.get("收批地"))
    recv_norm = normalize_receiving_place(recv_raw)
    if recv_norm:
        out["收批地"] = recv_norm
        out["收批地_标准化"] = recv_norm
    else:
        out["收批地_标准化"] = ""
        if recv_raw and not is_valid_receiving_place(recv_raw):
            out["收批地"] = ""

    country_std = infer_country_from_hints(
        country_raw=out.get("寄批地_国家") or out.get("寄批地") or "",
        city_zh=clean_field_text(out.get("寄批地_城市")),
        city_en=clean_field_text(out.get("寄批地_城市_英文")),
        bureau=clean_field_text(out.get("寄批地_批局")),
    )
    if country_std:
        out["寄批地_国家_标准化"] = country_std
        # Align display country when standardized differs from garbage raw value
        raw_country = normalize_country_name(out.get("寄批地_国家"))
        if country_std != raw_country and country_std in CANONICAL_SEND_COUNTRIES:
            out["寄批地_国家"] = country_std

    city_zh = clean_field_text(out.get("寄批地_城市"))
    city_en = clean_field_text(out.get("寄批地_城市_英文"))
    city_country = infer_country_from_hints(city_zh=city_zh, city_en=city_en, bureau="")
    if city_country and city_country != country_std:
        # City gazetteer wins over wrong country (e.g. 汕头 under 新加坡)
        out["寄批地_国家_标准化"] = city_country
        country_std = city_country
        if city_country in CANONICAL_SEND_COUNTRIES:
            out["寄批地_国家"] = city_country

    lat, lng = lookup_recv_coords(out.get("收批地") or out.get("收批地_标准化"))
    if lat is not None and lng is not None:
        out["收批地_纬度"] = lat
        out["收批地_经度"] = lng

    return out
