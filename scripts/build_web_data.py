#!/usr/bin/env python3
"""
Build data_index.json (fast initial load) and per-country chunk JSON (on demand).

Usage:
  python scripts/build_web_data.py
  python scripts/build_web_data.py --input data.json --out-dir .
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from location_gazetteer import (  # noqa: E402
    CANONICAL_SEND_COUNTRIES,
    clean_field_text,
    infer_country_from_hints,
    is_valid_receiving_place,
    normalize_receiving_place,
)

COUNTRY_WIDE_LABEL = "__COUNTRY_WIDE__"

CHUNK_SLUG: dict[str, str] = {
    "中国大陆": "china",
    "泰国": "thailand",
    "新加坡": "singapore",
    "马来西亚": "malaysia",
    "香港": "hong-kong",
    "印度尼西亚": "indonesia",
    "越南": "vietnam",
    "柬埔寨": "cambodia",
    "老挝": "laos",
    "文莱": "brunei",
    "澳大利亚": "australia",
}


def normalize_city_text(v: object) -> str:
    t = clean_field_text(v)
    if not t:
        return ""
    t = re.sub(r"[【】\[\]()（）]", "", t)
    t = re.sub(r"[，。、]", "", t).strip()
    low = t.lower()
    if low in ("不详", "unknown", "n/a", "na"):
        return "不详"
    return t


def city_label_from_row(row: dict[str, Any]) -> str:
    city_zh = normalize_city_text(row.get("寄批地_城市"))
    city_en = normalize_city_text(row.get("寄批地_城市_英文"))
    if city_zh == "不详" or city_en == "不详":
        return "不详"
    if city_zh and city_en:
        return f"{city_zh} ({city_en})"
    if city_zh or city_en:
        return city_zh or city_en
    return "不详"


def receiving_label_from_row(row: dict[str, Any]) -> str:
    raw = normalize_city_text(row.get("收批地_标准化") or row.get("收批地"))
    if not raw or raw == "不详":
        return ""
    if not is_valid_receiving_place(raw):
        return ""
    return normalize_receiving_place(raw) or raw


def row_country(row: dict[str, Any]) -> str:
    std = clean_field_text(row.get("寄批地_国家_标准化"))
    inferred = infer_country_from_hints(
        country_raw=row.get("寄批地_国家") or row.get("寄批地") or "",
        city_zh=row.get("寄批地_城市") or "",
        city_en=row.get("寄批地_城市_英文") or "",
        bureau=row.get("寄批地_批局") or "",
    )
    # Prefer city/bureau-derived country when it is canonical. This prevents
    # stale/mis-entered standardized country values from mis-grouping cities.
    if inferred in CANONICAL_SEND_COUNTRIES:
        return inferred
    if std in CANONICAL_SEND_COUNTRIES:
        return std
    return inferred if inferred else "其他"


def valid_lat_lng(lat: float | None, lng: float | None) -> bool:
    return (
        lat is not None
        and lng is not None
        and -90 <= lat <= 90
        and -180 <= lng <= 180
    )


def origin_lat_lng(row: dict[str, Any]) -> tuple[float | None, float | None]:
    try:
        lat = float(row.get("寄批地_纬度"))
        lng = float(row.get("寄批地_经度"))
    except (TypeError, ValueError):
        return None, None
    if valid_lat_lng(lat, lng):
        return lat, lng
    return None, None


def recv_lat_lng(row: dict[str, Any]) -> tuple[float | None, float | None]:
    try:
        lat = float(row.get("收批地_纬度"))
        lng = float(row.get("收批地_经度"))
    except (TypeError, ValueError):
        return None, None
    if valid_lat_lng(lat, lng):
        return lat, lng
    return None, None


def is_country_wide_row(row: dict[str, Any], country: str) -> bool:
    label = city_label_from_row(row)
    if label == "不详":
        return True
    zh = normalize_city_text(row.get("寄批地_城市"))
    en = normalize_city_text(row.get("寄批地_城市_英文"))
    if not zh and not en:
        return True
    compact = re.sub(r"\s+", "", label)
    if country and country in compact:
        return True
    return False


def origin_city_key(row: dict[str, Any], country: str) -> str:
    if is_country_wide_row(row, country):
        return COUNTRY_WIDE_LABEL
    return city_label_from_row(row)


def avg_center(rows: list[dict[str, Any]], lat_key: str, lng_key: str) -> tuple[float | None, float | None]:
    lats: list[float] = []
    lngs: list[float] = []
    for row in rows:
        try:
            lat = float(row.get(lat_key))
            lng = float(row.get(lng_key))
        except (TypeError, ValueError):
            continue
        if valid_lat_lng(lat, lng):
            lats.append(lat)
            lngs.append(lng)
    if not lats:
        return None, None
    return sum(lats) / len(lats), sum(lngs) / len(lngs)


def city_tokens(label: str) -> list[str]:
    m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", label or "")
    if m:
        return [m.group(1).lower().strip(), m.group(2).lower().strip()]
    return [(label or "").lower().strip()]


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Build web index + country chunks from data.json")
    parser.add_argument("--input", type=Path, default=root / "data.json")
    parser.add_argument("--out-dir", type=Path, default=root)
    args = parser.parse_args()

    with args.input.open(encoding="utf-8") as f:
        data = json.load(f)
    rows = data if isinstance(data, list) else data.get("letters", [])
    if not isinstance(rows, list):
        raise SystemExit("Expected list or {letters: [...]}")

    chunks: dict[str, list[dict[str, Any]]] = defaultdict(list)
    letter_count_by_country: dict[str, int] = defaultdict(int)
    origin_city_rows: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    recv_city_rows: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    all_recv_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    search: list[dict[str, Any]] = []

    for idx, row in enumerate(rows):
        country = row_country(row)
        slug = CHUNK_SLUG.get(country, "other")
        chunks[slug].append(row)
        local_idx = len(chunks[slug]) - 1
        letter_count_by_country[country] += 1

        okey = origin_city_key(row, country)
        origin_city_rows[(country, okey)].append(row)

        recv = receiving_label_from_row(row)
        if recv:
            recv_city_rows[(country, recv)].append(row)
            all_recv_rows[recv].append(row)

        search.append(
            {
                "country": country,
                "chunk": slug,
                "idx": local_idx,
                "eid": row.get("EID") or "",
                "sender": clean_field_text(row.get("寄批人")),
                "recipient": clean_field_text(row.get("收批人")),
                "city": city_label_from_row(row),
                "recv": recv or clean_field_text(row.get("收批地")),
                "date": clean_field_text(row.get("寄批时间")),
            }
        )

    def city_meta(grouped: dict[tuple[str, str], list[dict[str, Any]]], lat_key: str, lng_key: str) -> dict[str, list[dict]]:
        out: dict[str, list[dict]] = defaultdict(list)
        for (country, label), group in grouped.items():
            lat, lng = avg_center(group, lat_key, lng_key)
            meta: dict[str, Any] = {
                "label": label,
                "count": len(group),
            }
            if lat is not None and lng is not None:
                meta["lat"] = round(lat, 5)
                meta["lng"] = round(lng, 5)
            out[country].append(meta)
        for country in out:
            out[country].sort(key=lambda x: (-x["count"], x["label"]))
        return dict(out)

    origin_cities = city_meta(origin_city_rows, "寄批地_纬度", "寄批地_经度")
    receiving_cities = city_meta(recv_city_rows, "收批地_纬度", "收批地_经度")

    # Precompute global "letters to this place name" counts (matches map_app.js countToFromForCity).
    to_counts: dict[tuple[str, str], int] = {}
    for (country, label) in origin_city_rows:
        if label == COUNTRY_WIDE_LABEL:
            continue
        tokens = [t for t in city_tokens(label) if t]
        if not tokens:
            continue
        total = 0
        for row in rows:
            recv = (receiving_label_from_row(row) or clean_field_text(row.get("收批地"))).lower()
            if recv and any(t in recv for t in tokens):
                total += 1
        to_counts[(country, label)] = total

    for country, cities in origin_cities.items():
        for city in cities:
            label = city["label"]
            city["toCount"] = to_counts.get((country, label), 0)

    all_receiving = []
    for label, group in sorted(all_recv_rows.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        lat, lng = avg_center(group, "收批地_纬度", "收批地_经度")
        item: dict[str, Any] = {"label": label, "count": len(group)}
        if lat is not None and lng is not None:
            item["lat"] = round(lat, 5)
            item["lng"] = round(lng, 5)
        all_receiving.append(item)

    chunk_dir = args.out_dir / "data" / "chunks"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    chunk_urls: dict[str, str] = {}
    for country, slug in CHUNK_SLUG.items():
        chunk_urls[country] = f"data/chunks/{slug}.json"
    chunk_urls["其他"] = "data/chunks/other.json"

    for slug, chunk_rows in chunks.items():
        path = chunk_dir / f"{slug}.json"
        with path.open("w", encoding="utf-8") as f:
            json.dump(chunk_rows, f, ensure_ascii=False, separators=(",", ":"))
        size_mb = path.stat().st_size / (1024 * 1024)
        print(f"  chunk {path.name}: {len(chunk_rows):,} rows, {size_mb:.2f} MB")

    index = {
        "version": 1,
        "totalCount": len(rows),
        "letterCountByCountry": dict(sorted(letter_count_by_country.items(), key=lambda kv: -kv[1])),
        "originCitiesByCountry": origin_cities,
        "receivingCitiesByCountry": receiving_cities,
        "allReceivingCities": all_receiving,
        "chunks": chunk_urls,
        "countryWideLabel": COUNTRY_WIDE_LABEL,
    }

    index_path = args.out_dir / "data_index.json"
    with index_path.open("w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    index_mb = index_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {index_path} ({index_mb:.2f} MB)")

    search_path = args.out_dir / "data_search.json"
    with search_path.open("w", encoding="utf-8") as f:
        json.dump({"search": search}, f, ensure_ascii=False, separators=(",", ":"))
    search_mb = search_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {search_path} ({search_mb:.2f} MB, {len(search):,} entries)")


if __name__ == "__main__":
    main()
