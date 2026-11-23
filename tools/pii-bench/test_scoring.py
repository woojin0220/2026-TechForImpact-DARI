import unittest
import torch
from bioes import decode, spans_from_path
from fixtures import cases
from run import metrics
from expanded import cases as expanded_cases, windows
from compare import group_tokens, score_case


class ScoringTests(unittest.TestCase):
    def test_repeat_occurrence_must_be_covered_separately(self):
        score = metrics("Amy Amy", [{"start": 0, "end": 3}, {"start": 4, "end": 7}], [{"start": 0, "end": 3}])
        self.assertEqual(score["covered_entities"], 1)
        self.assertFalse(score["leak_free"])

    def test_partial_identifier_is_a_leak(self):
        score = metrics("AB-12", [{"start": 0, "end": 5}], [{"start": 0, "end": 4}])
        self.assertEqual(score["covered_entities"], 0)
        self.assertEqual(score["fn"], 1)

    def test_event_date_counts_as_overmask(self):
        score = metrics("2024년", [], [{"start": 0, "end": 5}])
        self.assertEqual(score["fp"], 5)

    def test_bioes_constraints_join_valid_span(self):
        labels = {0: "O", 1: "B-name", 2: "I-name", 3: "E-name", 4: "S-name"}
        logits = torch.tensor([[0., 8., 0., 0., 0.], [0., 0., 8., 0., 0.], [0., 0., 0., 8., 0.]])
        path = decode(logits, labels)
        self.assertEqual(path, [1, 2, 3])
        self.assertEqual(spans_from_path(path, [(0, 1), (1, 2), (2, 3)], labels, "Amy"), [{"start": 0, "end": 3, "label": "name"}])

    def test_bioes_disallows_initial_inside(self):
        labels = {0: "O", 1: "B-name", 2: "I-name", 3: "E-name", 4: "S-name"}
        self.assertEqual(decode(torch.tensor([[0., 1., 20., 1., 5.]]), labels), [4])

    def test_fixture_counts_and_unicode_offsets(self):
        rows = cases()
        self.assertEqual(len(rows), 42)
        self.assertEqual(sum(len(r["gold"]) for r in rows if r["track"] == "identifiers"), 78)
        for row in rows:
            self.assertNotIn("[[", row["text"])
            for gold in row["gold"]:
                self.assertTrue(row["text"][gold["start"]:gold["end"]])

    def test_expanded_fixture_retains_original_cases(self):
        old, new = cases(), expanded_cases()
        self.assertEqual(len(new), 90)
        self.assertEqual(len({r["id"] for r in new}), 90)
        for before, after in zip(old, new):
            for key in before:
                self.assertEqual(before[key], after[key])
        for row in new:
            self.assertNotIn("[[", row["text"])
            for gold in row["gold"] + row["protected"]:
                self.assertTrue(0 <= gold["start"] < gold["end"] <= len(row["text"]))

    def test_chunk_overlap_covers_crossing_identifier(self):
        text = "가" * 210 + "test.contact@example.org" + "나" * 400
        chunks = list(windows(text))
        self.assertTrue(any("test.contact@example.org" in value for _, value in chunks))
        self.assertEqual(set(range(len(text))), {i for offset, value in chunks for i in range(offset, offset + len(value))})
        self.assertTrue(all(len(value) <= 220 for _, value in chunks))

    def test_protected_date_damage_counted(self):
        case = {"text": "born 1987; event 2023", "gold": [{"start": 5, "end": 9}], "protected": [{"start": 17, "end": 21}]}
        score = score_case(case, [{"start": 5, "end": 9}, {"start": 17, "end": 21}])
        self.assertEqual(score["protected_hits"], 1)
        self.assertEqual(score["covered_entities"], 1)

    def test_bio_grouping_keeps_split_address_types(self):
        labels = {0: "O", 1: "B-CITY", 2: "B-STREET_ADDRESS", 3: "I-STREET_ADDRESS"}
        spans = group_tokens([1, 0, 2, 3], [(0, 4), (4, 6), (6, 9), (9, 14)], labels, "Lyon, rue Lune")
        self.assertEqual(spans, [{"start": 0, "end": 4, "label": "CITY"}, {"start": 6, "end": 14, "label": "STREET_ADDRESS"}])


if __name__ == "__main__":
    unittest.main()
