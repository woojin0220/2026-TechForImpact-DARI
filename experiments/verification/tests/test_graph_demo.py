from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from dari_verification.contracts import VerificationCase
from dari_verification.graph_demo import (
    GraphDemoViolation,
    align_graphs,
    compare_graphs,
    load_demo_spec,
    materialize_graph,
    run_demo_file,
    validate_graph,
)


DEMO_PATH = (
    Path(__file__).parents[1]
    / "demos"
    / "graph_pipeline"
    / "demo_cases.json"
)
TEST_COMMIT = "0" * 40


class GraphPipelineDemoTests(unittest.TestCase):
    def setUp(self):
        self.spec = load_demo_spec(DEMO_PATH)
        self.results = run_demo_file(DEMO_PATH, git_commit=TEST_COMMIT)

    def test_four_demo_cases_cover_sentence_paragraph_and_faithful_paths(self):
        self.assertEqual(len(self.results), 4)
        by_id = {result["trace"]["case_id"]: result for result in self.results}

        role = by_id["demo-actor-role-swap"]
        self.assertEqual(role["report"]["status"], "issues_found")
        self.assertEqual(
            [item["type"] for item in role["report"]["findings"]],
            ["actor_role_change"],
        )

        compound = by_id["demo-attribution-certainty"]
        self.assertEqual(compound["report"]["status"], "issues_found")
        self.assertEqual(len(compound["report"]["findings"]), 1)
        finding = compound["report"]["findings"][0]
        self.assertEqual(finding["type"], "source_attribution_change")
        self.assertEqual(finding["related_types"], ["certainty_shift"])
        comparator = compound["trace"]["modules"]["M4_typed_comparator"]["output"]
        self.assertEqual(
            {item["type"] for item in comparator["candidate_diffs"]},
            {"source_attribution_change", "certainty_shift"},
        )
        self.assertEqual(comparator["suppressed_generic_omissions"], ["s-report"])
        attribution = next(
            item
            for item in comparator["candidate_diffs"]
            if item["type"] == "source_attribution_change"
        )
        self.assertIn("s-report", attribution["source_element_ids"])
        self.assertIn("s-report-actor", attribution["source_element_ids"])
        self.assertIn("s-report-content", attribution["source_element_ids"])
        self.assertEqual(attribution["details"]["source_reporters"], ["sujin"])
        self.assertEqual(attribution["details"]["translation_reporters"], [])

        faithful = by_id["demo-faithful-one-to-many"]
        self.assertEqual(faithful["report"]["status"], "completed")
        self.assertEqual(faithful["report"]["findings"], [])
        alignments = faithful["trace"]["modules"]["M3_cross_lingual_aligner"]["output"]
        self.assertEqual(alignments["event_alignments"][0]["cardinality"], "1:2")

        paragraph = by_id["demo-paragraph-certainty"]
        self.assertGreaterEqual(
            paragraph["trace"]["modules"]["M0_input_contract"]["input"]["source"]["text"].count("."),
            4,
        )
        self.assertEqual(paragraph["report"]["status"], "issues_found")
        self.assertEqual(
            [item["type"] for item in paragraph["report"]["findings"]],
            ["certainty_shift"],
        )
        paragraph_modules = paragraph["trace"]["modules"]
        self.assertEqual(len(paragraph_modules), 7)
        paragraph_alignment = paragraph_modules["M3_cross_lingual_aligner"]["output"]
        self.assertEqual(len(paragraph_alignment["event_alignments"]), 5)
        self.assertEqual(
            {item["cardinality"] for item in paragraph_alignment["event_alignments"]},
            {"1:1"},
        )
        paragraph_comparison = paragraph_modules["M4_typed_comparator"]["output"]
        self.assertEqual(
            [item["type"] for item in paragraph_comparison["candidate_diffs"]],
            ["certainty_shift"],
        )

    def test_every_report_span_exactly_matches_the_original_text(self):
        cases = {item["case"]["case_id"]: item["case"] for item in self.spec["cases"]}
        for result in self.results:
            raw_case = cases[result["report"]["case_id"]]
            for finding in result["report"]["findings"]:
                for document, key in (
                    ("source", "source_span"),
                    ("translation", "translation_span"),
                ):
                    span = finding[key]
                    text = raw_case[document]["text"]
                    self.assertEqual(text[span["start"] : span["end"]], span["quote"])

    def test_extractor_trace_keeps_source_and_translation_inputs_separate(self):
        for result in self.results:
            calls = result["trace"]["modules"]["M1_graph_extractor"]["input"]
            self.assertEqual([item["document"] for item in calls], ["source", "translation"])
            self.assertEqual(set(calls[0]["payload"]), {"language", "text"})
            self.assertEqual(set(calls[1]["payload"]), {"language", "text"})
            self.assertNotIn("translation", calls[0]["payload"])
            self.assertNotIn("source", calls[1]["payload"])

    def test_demo_is_deterministic_for_a_fixed_commit(self):
        again = run_demo_file(DEMO_PATH, git_commit=TEST_COMMIT)
        self.assertEqual(
            json.dumps(self.results, ensure_ascii=False, sort_keys=True),
            json.dumps(again, ensure_ascii=False, sort_keys=True),
        )

    def test_graph_validator_rejects_an_unknown_endpoint(self):
        raw = deepcopy(self.spec["cases"][0])
        case = VerificationCase.from_mapping(raw["case"])
        graph = materialize_graph(raw["graphs"]["source"], case, "source")
        graph["edges"][0]["target_id"] = "missing-node"
        with self.assertRaisesRegex(GraphDemoViolation, "endpoint does not exist"):
            validate_graph(graph, case, "source")

    def test_materializer_rejects_stale_or_ambiguous_evidence(self):
        raw = deepcopy(self.spec["cases"][0])
        case = VerificationCase.from_mapping(raw["case"])
        raw["graphs"]["source"]["nodes"][0]["evidence"] = "없는 문구"
        with self.assertRaisesRegex(GraphDemoViolation, "not present"):
            materialize_graph(raw["graphs"]["source"], case, "source")

    def test_validator_requires_adjudicated_core_qualifiers_for_every_event(self):
        raw = deepcopy(self.spec["cases"][0])
        case = VerificationCase.from_mapping(raw["case"])
        raw["graphs"]["source"]["qualifiers"] = [
            item
            for item in raw["graphs"]["source"]["qualifiers"]
            if item["type"] != "certainty"
        ]
        graph = materialize_graph(raw["graphs"]["source"], case, "source")
        with self.assertRaisesRegex(GraphDemoViolation, "missing qualifier certainty"):
            validate_graph(graph, case, "source")

    def test_temporal_dimensions_merge_into_one_candidate(self):
        raw = deepcopy(
            next(
                item
                for item in self.spec["cases"]
                if item["case"]["case_id"] == "demo-faithful-one-to-many"
            )
        )
        case = VerificationCase.from_mapping(raw["case"])
        source = materialize_graph(raw["graphs"]["source"], case, "source")
        translation = materialize_graph(
            raw["graphs"]["translation"], case, "translation"
        )
        next(
            node for node in translation["nodes"] if node["id"] == "t-next-morning"
        )["normalized"] = "DIFFERENT_DAY"
        source_time = next(
            node for node in source["nodes"] if node["id"] == "s-next-morning"
        )
        translation_time = next(
            node for node in translation["nodes"] if node["id"] == "t-next-morning"
        )
        source_duration = deepcopy(source_time)
        source_duration.update(
            {
                "id": "s-duration",
                "semantic_type": "DURATION",
                "normalized": "SHORT_DURATION",
                "canonical_key": "release-duration",
            }
        )
        translation_duration = deepcopy(translation_time)
        translation_duration.update(
            {
                "id": "t-duration",
                "semantic_type": "DURATION",
                "normalized": "LONG_DURATION",
                "canonical_key": "release-duration",
            }
        )
        source["nodes"].append(source_duration)
        translation["nodes"].append(translation_duration)
        source_duration_edge = deepcopy(
            next(edge for edge in source["edges"] if edge["type"] == "AT_TIME")
        )
        source_duration_edge.update(
            {"id": "s-release-duration", "type": "DURATION", "target_id": "s-duration"}
        )
        translation_duration_edge = deepcopy(
            next(edge for edge in translation["edges"] if edge["type"] == "AT_TIME")
        )
        translation_duration_edge.update(
            {
                "id": "t-release-duration",
                "type": "DURATION",
                "target_id": "t-duration",
            }
        )
        source["edges"].append(source_duration_edge)
        translation["edges"].append(translation_duration_edge)
        validate_graph(source, case, "source")
        validate_graph(translation, case, "translation")
        comparison = compare_graphs(
            source, translation, align_graphs(source, translation), case
        )
        self.assertEqual(len(comparison["candidate_diffs"]), 1)
        candidate = comparison["candidate_diffs"][0]
        self.assertEqual(candidate["type"], "temporal_change")
        self.assertEqual(
            candidate["details"]["changed_temporal_edges"],
            ["AT_TIME", "DURATION"],
        )


if __name__ == "__main__":
    unittest.main()
