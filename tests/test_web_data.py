from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_web_data import route_metadata, row_country  # noqa: E402
from location_gazetteer import CANONICAL_SEND_COUNTRIES, is_valid_receiving_place  # noqa: E402


class WebDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with (ROOT / "data.json").open(encoding="utf-8") as handle:
            source = json.load(handle)
        cls.rows = source if isinstance(source, list) else source["letters"]
        cls.by_eid = {str(row["EID"]): row for row in cls.rows}

    def test_country_grouping_is_closed_and_complete(self) -> None:
        counts = Counter(row_country(row) for row in self.rows)
        self.assertEqual(sum(counts.values()), 50_064)
        self.assertTrue(set(counts) <= set(CANONICAL_SEND_COUNTRIES) | {"其他"})
        self.assertEqual(counts["其他"], 187)

    def test_receiving_place_validation_fails_closed(self) -> None:
        self.assertTrue(is_valid_receiving_place("广东潮安"))
        self.assertFalse(is_valid_receiving_place("广东潮"))
        self.assertFalse(is_valid_receiving_place("广东陈锐"))

    def test_only_exact_split_field_repairs_are_applied(self) -> None:
        expected = {
            "78004352": ("广东潮安", "王兰香"),
            "78014392": ("广东饶平", "父母"),
            "78037727": ("广东潮安", "母亲"),
            "78060646": ("广东潮安", "许就德"),
        }
        repairs = {}
        for row in self.rows:
            route = route_metadata(row, row_country(row))
            if route["parseMethod"] == "split_field_rejoin":
                repairs[str(row["EID"])] = (route["destinationLabel"], route["recipientDisplay"])
        self.assertEqual(repairs, expected)

    def test_return_letter_is_routed_overseas(self) -> None:
        row = self.by_eid["78007824"]
        route = route_metadata(row, row_country(row))
        self.assertEqual(route["direction"], "return")
        self.assertEqual(route["destinationCountry"], "马来西亚")
        self.assertEqual(route["destinationLabel"], "吉隆坡 (Kuala Lumpur)")
        self.assertEqual(route["destinationStatus"], "inferred")

    def test_ambiguous_place_is_flagged_not_mapped(self) -> None:
        row = self.by_eid["78021966"]
        route = route_metadata(row, row_country(row))
        self.assertEqual(route["destinationStatus"], "needs_review")
        self.assertEqual(route["destinationLabel"], "")
        self.assertNotIn("destinationLat", route)

    def test_generated_files_preserve_source_and_search_pointers(self) -> None:
        with (ROOT / "data_index.json").open(encoding="utf-8") as handle:
            index = json.load(handle)
        with (ROOT / "data_search.json").open(encoding="utf-8") as handle:
            search = json.load(handle)["search"]

        self.assertEqual(index["version"], 2)
        self.assertEqual(index["totalCount"], len(self.rows))
        self.assertEqual(sum(index["letterCountByCountry"].values()), len(self.rows))
        self.assertTrue(set(index["letterCountByCountry"]) <= set(CANONICAL_SEND_COUNTRIES) | {"其他"})
        self.assertEqual(len(search), len(self.rows))

        chunks = {}
        for country, rel_path in index["chunks"].items():
            if rel_path in chunks:
                continue
            with (ROOT / rel_path).open(encoding="utf-8") as handle:
                chunks[rel_path] = json.load(handle)

        self.assertEqual(sum(len(chunk) for chunk in chunks.values()), len(self.rows))
        source_by_eid = self.by_eid
        seen = set()
        for chunk in chunks.values():
            for generated in chunk:
                eid = str(generated["EID"])
                self.assertNotIn(eid, seen)
                seen.add(eid)
                archival_fields = dict(generated)
                route = archival_fields.pop("_route")
                self.assertEqual(archival_fields, source_by_eid[eid])
                self.assertIn(route["destinationStatus"], {"verified", "inferred", "needs_review", "unknown"})

        for entry in search:
            country = entry["country"]
            rel_path = index["chunks"].get(country, index["chunks"]["其他"])
            generated = chunks[rel_path][entry["idx"]]
            self.assertEqual(str(generated["EID"]), str(entry["eid"]))

        labels = {item["label"] for item in index["allReceivingCities"]}
        self.assertIn("吉隆坡 (Kuala Lumpur)", labels)
        self.assertIn("新加坡 (Singapore)", labels)

    def test_clean_rebuild_is_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            out_dir = Path(temp_dir)
            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "build_web_data.py"),
                    "--input",
                    str(ROOT / "data.json"),
                    "--out-dir",
                    str(out_dir),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            generated_paths = [ROOT / "data_index.json", ROOT / "data_search.json"]
            generated_paths.extend(sorted((ROOT / "data" / "chunks").glob("*.json")))
            for expected in generated_paths:
                relative = expected.relative_to(ROOT)
                self.assertEqual(expected.read_bytes(), (out_dir / relative).read_bytes(), str(relative))


if __name__ == "__main__":
    unittest.main()
