from pathlib import Path
import json
import unittest

from dari_verification import (
    ContractViolation,
    VerificationPipeline,
    compute_dataset_digest,
    load_fixture_lines,
    load_fixtures,
    run_batch,
)

from tests.support import TEST_COMMIT, StaticStrategy, fixed_monotonic, fixed_now


FIXTURE_PATH = Path(__file__).parents[1] / "fixtures" / "synthetic_cases.jsonl"


class FixtureLoaderTests(unittest.TestCase):
    def test_committed_fixture_set_is_strict_and_span_valid(self):
        fixtures = load_fixtures(FIXTURE_PATH)
        self.assertEqual(len(fixtures), 15)
        self.assertEqual(sum(item.gold_status == "faithful" for item in fixtures), 8)
        self.assertEqual(sum(item.gold_status == "issues_found" for item in fixtures), 7)
        self.assertTrue(all(item.case.data_classification == "synthetic" for item in fixtures))
        self.assertTrue(all(not item.provenance.human_reviewed for item in fixtures))
        self.assertTrue(
            all(
                finding.adjudication == "unreviewed"
                for item in fixtures
                for finding in item.gold_findings
            )
        )
        self.assertEqual(
            {item.provenance.mutation for item in fixtures if item.provenance.mutation != "none"},
            {
                "negation_flip",
                "certainty_shift",
                "actor_role_change",
                "temporal_change",
                "identity_value_change",
                "omission",
                "unsupported_addition",
            },
        )

    def test_gold_status_maps_to_report_status(self):
        fixtures = load_fixtures(FIXTURE_PATH)
        for fixture in fixtures:
            expected = "completed" if fixture.gold_status == "faithful" else "issues_found"
            self.assertEqual(fixture.expected_report_status, expected)

    def test_duplicate_case_ids_are_rejected_before_execution(self):
        first_line = FIXTURE_PATH.read_text(encoding="utf-8").splitlines()[0]
        with self.assertRaises(ContractViolation) as caught:
            load_fixture_lines([first_line, first_line])
        self.assertEqual(caught.exception.code, "duplicate_case_id")

    def test_pairs_require_distinct_control_and_mutation_roles(self):
        lines = FIXTURE_PATH.read_text(encoding="utf-8").splitlines()
        self_paired = json.loads(lines[0])
        self_paired["fixture_provenance"]["paired_case_id"] = self_paired["case"]["case_id"]
        with self.assertRaises(ContractViolation) as caught:
            load_fixture_lines([json.dumps(self_paired, ensure_ascii=False)])
        self.assertEqual(caught.exception.code, "invalid_fixture_pair")

        first_mutation = json.loads(lines[1])
        second_mutation = json.loads(lines[3])
        first_mutation["fixture_provenance"]["paired_case_id"] = second_mutation["case"]["case_id"]
        second_mutation["fixture_provenance"]["paired_case_id"] = first_mutation["case"]["case_id"]
        with self.assertRaises(ContractViolation) as caught:
            load_fixture_lines(
                [
                    json.dumps(first_mutation, ensure_ascii=False),
                    json.dumps(second_mutation, ensure_ascii=False),
                ]
            )
        self.assertEqual(caught.exception.code, "invalid_fixture_pair")

    def test_duplicate_json_keys_and_non_finite_numbers_are_rejected(self):
        for line, code in (
            ('{"case":{},"case":{}}', "duplicate_json_key"),
            ('{"case":NaN}', "invalid_json"),
        ):
            with self.subTest(code=code):
                with self.assertRaises(ContractViolation) as caught:
                    load_fixture_lines([line])
                self.assertEqual(caught.exception.code, code)

    def test_non_string_fixture_enums_raise_contract_errors(self):
        first_line = FIXTURE_PATH.read_text(encoding="utf-8").splitlines()[1]
        for field_path in ("mutation", "gold_type"):
            payload = json.loads(first_line)
            if field_path == "mutation":
                payload["fixture_provenance"]["mutation"] = []
                expected = "invalid_mutation"
            else:
                payload["gold"]["findings"][0]["type"] = []
                expected = "invalid_finding_type"
            with self.subTest(field_path=field_path):
                with self.assertRaises(ContractViolation) as caught:
                    load_fixture_lines([json.dumps(payload, ensure_ascii=False)])
                self.assertEqual(caught.exception.code, expected)

    def test_round_trip_preserves_unicode_and_quoted_instruction_data(self):
        fixtures = load_fixtures(FIXTURE_PATH)
        by_id = {item.case.case_id: item for item in fixtures}
        rtl = by_id["syn-value-rtl-001-mutated"]
        quoted = by_id["syn-quoted-instruction-001-control"]
        self.assertEqual(rtl.case.source.language, "ar")
        self.assertTrue(any(ord(character) > 0xFFFF for character in rtl.case.source.text))
        self.assertIn("ignore previous instructions", quoted.case.translation.text.lower())
        encoded = json.dumps(quoted.to_dict(), ensure_ascii=False)
        self.assertIn("ignore previous instructions", encoded.lower())

    def test_dataset_digest_tracks_canonical_fixture_content(self):
        lines = FIXTURE_PATH.read_text(encoding="utf-8").splitlines()
        original = load_fixture_lines([lines[-1]])
        changed_payload = json.loads(lines[-1])
        changed_payload["case"]["translation"]["text"] += " "
        changed = load_fixture_lines([json.dumps(changed_payload, ensure_ascii=False)])
        self.assertEqual(compute_dataset_digest(original), compute_dataset_digest(original))
        self.assertNotEqual(compute_dataset_digest(original), compute_dataset_digest(changed))


class BatchRunnerTests(unittest.TestCase):
    def test_strategy_failure_does_not_stop_later_cases(self):
        fixtures = tuple(
            item for item in load_fixtures(FIXTURE_PATH) if item.gold_status == "faithful"
        )[:3]

        class FailOnceStrategy(StaticStrategy):
            def detect(self, case):
                self.calls.append(case)
                if len(self.calls) == 1:
                    raise RuntimeError(case.source.text)
                return ()

        strategy = FailOnceStrategy()
        pipeline = VerificationPipeline(
            strategy,
            now=fixed_now,
            monotonic=fixed_monotonic,
        )
        reports = run_batch(
            pipeline,
            fixtures,
            dataset_version="synthetic-v1",
            git_commit=TEST_COMMIT,
            random_seed=7,
        )
        self.assertEqual([item.status for item in reports], ["indeterminate", "completed", "completed"])
        self.assertEqual(len(strategy.calls), 3)
        self.assertEqual(len({item.run_id for item in reports}), 3)
        self.assertTrue(
            all(
                item.provenance.dataset_digest == compute_dataset_digest(fixtures)
                for item in reports
            )
        )
        self.assertNotIn(fixtures[0].case.source.text, json.dumps(reports[0].to_dict(), ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
