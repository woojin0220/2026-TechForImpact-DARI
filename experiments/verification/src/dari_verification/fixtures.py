from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable, Mapping

from .contracts import (
    CASE_ID_RE,
    FINDING_TYPES,
    Component,
    ContractViolation,
    EvidenceSpan,
    Finding,
    VerificationCase,
)


FIXTURE_VERSION = "1.0"
GOLD_STATUSES = frozenset({"faithful", "issues_found"})
AUTHORING_METHODS = frozenset({"human_written_synthetic", "model_assisted_synthetic"})
ADJUDICATIONS = frozenset({"agreed", "unreviewed"})


class _DuplicateKey(ValueError):
    pass


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise _DuplicateKey(key)
        result[key] = value
    return result


def _reject_non_finite(value: str) -> None:
    raise ValueError(f"non-finite number {value} is not allowed")


def _object(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ContractViolation("invalid_type", path, "must be an object")
    return value


def _strict_keys(
    value: Mapping[str, Any], *, required: set[str], optional: set[str], path: str
) -> None:
    missing = required - set(value)
    if missing:
        raise ContractViolation("missing_field", path, f"missing {sorted(missing)[0]}")
    unknown = set(value) - required - optional
    if unknown:
        raise ContractViolation("unknown_field", path, f"unknown {sorted(unknown)[0]}")


def _string(value: Any, path: str, *, maximum: int) -> str:
    if not isinstance(value, str):
        raise ContractViolation("invalid_type", path, "must be a string")
    if not 1 <= len(value) <= maximum:
        raise ContractViolation("invalid_length", path, f"length must be 1..{maximum}")
    return value


def _span(value: Any, path: str) -> EvidenceSpan | None:
    if value is None:
        return None
    return EvidenceSpan.from_mapping(value, path)


@dataclass(frozen=True)
class FixtureProvenance:
    fixture_version: str
    authoring_method: str
    mutation: str
    paired_case_id: str | None
    human_reviewed: bool

    @classmethod
    def from_mapping(cls, value: Any, path: str) -> "FixtureProvenance":
        raw = _object(value, path)
        _strict_keys(
            raw,
            required={
                "fixture_version",
                "authoring_method",
                "mutation",
                "paired_case_id",
                "human_reviewed",
            },
            optional=set(),
            path=path,
        )
        if raw["fixture_version"] != FIXTURE_VERSION:
            raise ContractViolation(
                "unsupported_fixture_version", f"{path}.fixture_version", "must equal 1.0"
            )
        authoring_method = raw["authoring_method"]
        if not isinstance(authoring_method, str) or authoring_method not in AUTHORING_METHODS:
            raise ContractViolation(
                "invalid_authoring_method", f"{path}.authoring_method", "is not supported"
            )
        mutation = raw["mutation"]
        if not isinstance(mutation, str) or (
            mutation != "none" and mutation not in FINDING_TYPES
        ):
            raise ContractViolation("invalid_mutation", f"{path}.mutation", "is not supported")
        paired_case_id = raw["paired_case_id"]
        if paired_case_id is not None and (
            not isinstance(paired_case_id, str) or not CASE_ID_RE.fullmatch(paired_case_id)
        ):
            raise ContractViolation(
                "invalid_case_id", f"{path}.paired_case_id", "contains unsupported characters"
            )
        human_reviewed = raw["human_reviewed"]
        if not isinstance(human_reviewed, bool):
            raise ContractViolation(
                "invalid_type", f"{path}.human_reviewed", "must be boolean"
            )
        return cls(
            fixture_version=FIXTURE_VERSION,
            authoring_method=authoring_method,
            mutation=mutation,
            paired_case_id=paired_case_id,
            human_reviewed=human_reviewed,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "fixture_version": self.fixture_version,
            "authoring_method": self.authoring_method,
            "mutation": self.mutation,
            "paired_case_id": self.paired_case_id,
            "human_reviewed": self.human_reviewed,
        }


@dataclass(frozen=True)
class GoldFinding:
    finding_id: str
    type: str
    related_types: tuple[str, ...]
    change: str
    severity: str
    source_span: EvidenceSpan | None
    translation_span: EvidenceSpan | None
    evidence_absence_reason: str | None
    rationale: str
    adjudication: str

    @classmethod
    def from_mapping(cls, value: Any, path: str) -> "GoldFinding":
        raw = _object(value, path)
        _strict_keys(
            raw,
            required={
                "finding_id",
                "type",
                "related_types",
                "change",
                "severity",
                "source_span",
                "translation_span",
                "evidence_absence_reason",
                "rationale",
                "adjudication",
            },
            optional=set(),
            path=path,
        )
        related_types = raw["related_types"]
        if not isinstance(related_types, list) or not all(
            isinstance(item, str) for item in related_types
        ):
            raise ContractViolation(
                "invalid_type", f"{path}.related_types", "must be an array of strings"
            )
        adjudication = raw["adjudication"]
        if not isinstance(adjudication, str) or adjudication not in ADJUDICATIONS:
            raise ContractViolation(
                "invalid_adjudication", f"{path}.adjudication", "is not supported"
            )
        finding = cls(
            finding_id=_string(raw["finding_id"], f"{path}.finding_id", maximum=128),
            type=raw["type"],
            related_types=tuple(related_types),
            change=raw["change"],
            severity=raw["severity"],
            source_span=_span(raw["source_span"], f"{path}.source_span"),
            translation_span=_span(raw["translation_span"], f"{path}.translation_span"),
            evidence_absence_reason=raw["evidence_absence_reason"],
            rationale=raw["rationale"],
            adjudication=adjudication,
        )
        finding.as_runtime_finding()
        return finding

    def as_runtime_finding(self) -> Finding:
        return Finding(
            finding_id=self.finding_id,
            type=self.type,
            related_types=self.related_types,
            change=self.change,
            severity=self.severity,
            source_span=self.source_span,
            translation_span=self.translation_span,
            evidence_absence_reason=self.evidence_absence_reason,
            confidence=1.0,
            status="confirmed",
            detectors=(Component(id="gold_annotation", version=FIXTURE_VERSION),),
            rationale=self.rationale,
        )

    def validate_evidence(self, case: VerificationCase) -> None:
        self.as_runtime_finding().validate_evidence(case)

    def to_dict(self) -> dict[str, Any]:
        return {
            "finding_id": self.finding_id,
            "type": self.type,
            "related_types": list(self.related_types),
            "change": self.change,
            "severity": self.severity,
            "source_span": self.source_span.to_dict() if self.source_span else None,
            "translation_span": self.translation_span.to_dict() if self.translation_span else None,
            "evidence_absence_reason": self.evidence_absence_reason,
            "rationale": self.rationale,
            "adjudication": self.adjudication,
        }


@dataclass(frozen=True)
class Fixture:
    case: VerificationCase
    gold_status: str
    gold_findings: tuple[GoldFinding, ...]
    provenance: FixtureProvenance

    @property
    def expected_report_status(self) -> str:
        return "completed" if self.gold_status == "faithful" else "issues_found"

    def to_dict(self) -> dict[str, Any]:
        return {
            "case": self.case.to_dict(),
            "gold": {
                "status": self.gold_status,
                "findings": [item.to_dict() for item in self.gold_findings],
            },
            "fixture_provenance": self.provenance.to_dict(),
        }


def _parse_fixture(value: Any, path: str) -> Fixture:
    raw = _object(value, path)
    _strict_keys(
        raw,
        required={"case", "gold", "fixture_provenance"},
        optional=set(),
        path=path,
    )
    case = VerificationCase.from_mapping(raw["case"])
    provenance = FixtureProvenance.from_mapping(
        raw["fixture_provenance"], f"{path}.fixture_provenance"
    )
    gold = _object(raw["gold"], f"{path}.gold")
    _strict_keys(
        gold,
        required={"status", "findings"},
        optional=set(),
        path=f"{path}.gold",
    )
    gold_status = gold["status"]
    if not isinstance(gold_status, str) or gold_status not in GOLD_STATUSES:
        raise ContractViolation("invalid_gold_status", f"{path}.gold.status", "is not supported")
    raw_findings = gold["findings"]
    if not isinstance(raw_findings, list):
        raise ContractViolation("invalid_type", f"{path}.gold.findings", "must be an array")
    findings = tuple(
        GoldFinding.from_mapping(item, f"{path}.gold.findings[{index}]")
        for index, item in enumerate(raw_findings)
    )
    finding_ids = [item.finding_id for item in findings]
    if len(finding_ids) != len(set(finding_ids)):
        raise ContractViolation(
            "duplicate_finding_id", f"{path}.gold.findings", "finding IDs must be unique"
        )
    if gold_status == "faithful" and findings:
        raise ContractViolation(
            "invalid_gold_state", f"{path}.gold", "faithful fixtures cannot contain findings"
        )
    if gold_status == "issues_found" and not findings:
        raise ContractViolation(
            "invalid_gold_state", f"{path}.gold", "issues_found fixtures require findings"
        )
    if provenance.mutation == "none" and gold_status != "faithful":
        raise ContractViolation(
            "mutation_gold_mismatch", path, "control fixtures must be faithful"
        )
    if provenance.mutation != "none":
        if gold_status != "issues_found" or provenance.mutation not in {
            item.type for item in findings
        }:
            raise ContractViolation(
                "mutation_gold_mismatch", path, "mutation must match a gold finding type"
            )
    expected_adjudication = "agreed" if provenance.human_reviewed else "unreviewed"
    if any(item.adjudication != expected_adjudication for item in findings):
        raise ContractViolation(
            "review_state_mismatch",
            f"{path}.gold.findings",
            f"adjudication must be {expected_adjudication}",
        )
    for finding in findings:
        finding.validate_evidence(case)
    return Fixture(
        case=case,
        gold_status=gold_status,
        gold_findings=findings,
        provenance=provenance,
    )


def load_fixture_lines(lines: Iterable[str]) -> tuple[Fixture, ...]:
    fixtures: list[Fixture] = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        path = f"fixture[{line_number}]"
        try:
            value = json.loads(
                line,
                object_pairs_hook=_unique_object,
                parse_constant=_reject_non_finite,
            )
        except _DuplicateKey as error:
            raise ContractViolation(
                "duplicate_json_key", path, f"contains duplicate key {error.args[0]}"
            ) from None
        except (json.JSONDecodeError, ValueError):
            raise ContractViolation("invalid_json", path, "must be strict JSON") from None
        fixtures.append(_parse_fixture(value, path))

    if not fixtures:
        raise ContractViolation("empty_dataset", "fixtures", "must contain at least one fixture")
    by_id: dict[str, Fixture] = {}
    for fixture in fixtures:
        case_id = fixture.case.case_id
        if case_id in by_id:
            raise ContractViolation("duplicate_case_id", "fixtures", f"duplicate {case_id}")
        by_id[case_id] = fixture
    for fixture in fixtures:
        paired_case_id = fixture.provenance.paired_case_id
        if paired_case_id is None:
            if fixture.provenance.mutation != "none":
                raise ContractViolation(
                    "missing_paired_case",
                    "fixtures",
                    f"mutation {fixture.case.case_id} requires a faithful control",
                )
            continue
        if paired_case_id == fixture.case.case_id:
            raise ContractViolation(
                "invalid_fixture_pair", "fixtures", "a fixture cannot pair with itself"
            )
        paired = by_id.get(paired_case_id)
        if paired is None:
            raise ContractViolation(
                "missing_paired_case", "fixtures", f"missing {paired_case_id}"
            )
        if paired.provenance.paired_case_id != fixture.case.case_id:
            raise ContractViolation(
                "asymmetric_pair", "fixtures", f"pair for {fixture.case.case_id} is not reciprocal"
            )
        fixture_is_control = fixture.provenance.mutation == "none"
        paired_is_control = paired.provenance.mutation == "none"
        if fixture_is_control == paired_is_control:
            raise ContractViolation(
                "invalid_fixture_pair",
                "fixtures",
                "each pair must contain one faithful control and one mutation",
            )
        if (
            fixture.case.source != paired.case.source
            or fixture.case.translation.language != paired.case.translation.language
            or fixture.case.data_classification != paired.case.data_classification
            or fixture.case.context != paired.case.context
        ):
            raise ContractViolation(
                "invalid_fixture_pair",
                "fixtures",
                "paired fixtures must share source and non-text context",
            )
    return tuple(fixtures)


def load_fixtures(path: str | Path) -> tuple[Fixture, ...]:
    with Path(path).open("r", encoding="utf-8", newline="") as fixture_file:
        return load_fixture_lines(fixture_file)


def compute_dataset_digest(fixtures: Iterable[Fixture]) -> str:
    materialized = tuple(fixtures)
    if not materialized:
        raise ContractViolation("empty_dataset", "fixtures", "must contain at least one fixture")
    if any(not isinstance(item, Fixture) for item in materialized):
        raise ContractViolation("invalid_type", "fixtures", "must contain validated fixtures")
    encoded = json.dumps(
        [item.to_dict() for item in materialized],
        allow_nan=False,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
