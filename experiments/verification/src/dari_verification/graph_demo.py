from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from typing import Any, Iterable, Mapping, Sequence

from .contracts import Component, EvidenceSpan, Finding, VerificationCase
from .pipeline import VerificationPipeline


DEMO_VERSION = "1.0"
STRATEGY_ID = "scripted_graph_demo"
STRATEGY_VERSION = "1.0"
ROLE_EDGES = frozenset({"ACTOR", "TARGET", "EXPERIENCER", "RECIPIENT"})
QUALIFIER_TYPES = frozenset({"polarity", "certainty", "evidentiality", "tense_aspect"})
REQUIRED_EVENT_QUALIFIERS = frozenset({"polarity", "certainty", "evidentiality"})
TEMPORAL_VALUE_EDGES = frozenset({"AT_TIME", "DURATION"})
EVENT_EXCLUDED_FEATURES = (
    "ACTOR",
    "TARGET",
    "polarity",
    "certainty",
    "evidentiality",
    "temporal_direction",
    "causal_direction",
)
TYPE_PRIORITY = {
    "actor_role_change": 0,
    "source_attribution_change": 1,
    "certainty_shift": 2,
    "negation_flip": 3,
    "temporal_change": 4,
}
SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


class GraphDemoViolation(ValueError):
    pass


def _strict_keys(
    value: Mapping[str, Any], *, required: set[str], optional: set[str], path: str
) -> None:
    missing = required - set(value)
    if missing:
        raise GraphDemoViolation(f"{path}: missing {sorted(missing)[0]}")
    unknown = set(value) - required - optional
    if unknown:
        raise GraphDemoViolation(f"{path}: unknown {sorted(unknown)[0]}")


def _span_from_quote(document: str, text: str, quote: str) -> dict[str, Any]:
    if not isinstance(quote, str) or not quote:
        raise GraphDemoViolation(f"{document}: evidence quote must be a non-empty string")
    start = text.find(quote)
    if start < 0:
        raise GraphDemoViolation(f"{document}: evidence quote is not present: {quote!r}")
    if text.find(quote, start + 1) >= 0:
        raise GraphDemoViolation(
            f"{document}: evidence quote is ambiguous; use a longer unique quote: {quote!r}"
        )
    return {
        "document": document,
        "unit_id": f"{document}:0",
        "start": start,
        "end": start + len(quote),
        "quote": quote,
    }


def _materialize_element(
    raw: Mapping[str, Any], *, document: str, text: str, path: str
) -> dict[str, Any]:
    result = dict(raw)
    evidence = result.pop("evidence", None)
    if isinstance(evidence, str):
        quotes = [evidence]
    elif isinstance(evidence, list) and all(isinstance(item, str) for item in evidence):
        quotes = evidence
    else:
        raise GraphDemoViolation(f"{path}.evidence: must be a string or string array")
    result["evidence_spans"] = [_span_from_quote(document, text, quote) for quote in quotes]
    result.setdefault("explicit_or_inferred", "explicit")
    result.setdefault("confidence", 1.0)
    return result


def materialize_graph(
    raw: Mapping[str, Any], case: VerificationCase, document: str
) -> dict[str, Any]:
    _strict_keys(
        raw,
        required={"graph_id", "nodes", "edges", "qualifiers", "coverage"},
        optional=set(),
        path=f"graphs.{document}",
    )
    text_document = case.source if document == "source" else case.translation
    nodes = [
        _materialize_element(
            item,
            document=document,
            text=text_document.text,
            path=f"graphs.{document}.nodes[{index}]",
        )
        for index, item in enumerate(raw["nodes"])
    ]
    for node in nodes:
        key = node.pop("match_key", None)
        if not isinstance(key, str) or not key:
            raise GraphDemoViolation(f"graphs.{document}.nodes: match_key is required")
        node["alignment_key" if node.get("kind") == "event" else "canonical_key"] = key
        node.setdefault("alternative_group", None)
    edges = [
        _materialize_element(
            item,
            document=document,
            text=text_document.text,
            path=f"graphs.{document}.edges[{index}]",
        )
        for index, item in enumerate(raw["edges"])
    ]
    qualifiers = [
        _materialize_element(
            item,
            document=document,
            text=text_document.text,
            path=f"graphs.{document}.qualifiers[{index}]",
        )
        for index, item in enumerate(raw["qualifiers"])
    ]
    return {
        "graph_id": raw["graph_id"],
        "document": document,
        "language": text_document.language,
        "ontology_version": "dsg-demo-1.0",
        "event_family_map_version": "dsg-family-demo-1.0",
        "nodes": nodes,
        "edges": edges,
        "qualifiers": qualifiers,
        "coverage": dict(raw["coverage"]),
    }


def _validate_evidence_spans(
    elements: Iterable[Mapping[str, Any]], case: VerificationCase, document: str
) -> int:
    count = 0
    for element in elements:
        spans = element.get("evidence_spans")
        if not isinstance(spans, list) or not spans:
            raise GraphDemoViolation(f"{document}: every graph element needs evidence_spans")
        for raw_span in spans:
            span = EvidenceSpan.from_mapping(raw_span, f"graph.{document}.evidence")
            span.validate_against(case, expected_document=document)
            count += 1
    return count


def validate_graph(
    graph: Mapping[str, Any], case: VerificationCase, document: str
) -> dict[str, Any]:
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    qualifiers = graph.get("qualifiers")
    if not isinstance(nodes, list) or not isinstance(edges, list) or not isinstance(qualifiers, list):
        raise GraphDemoViolation(f"{document}: nodes, edges, and qualifiers must be arrays")

    all_elements = [*nodes, *edges, *qualifiers]
    ids = [element.get("id") for element in all_elements]
    if any(not isinstance(value, str) or not value for value in ids):
        raise GraphDemoViolation(f"{document}: every element needs a non-empty id")
    if len(ids) != len(set(ids)):
        raise GraphDemoViolation(f"{document}: graph element IDs must be unique")

    node_by_id = {node["id"]: node for node in nodes}
    for node in nodes:
        if node.get("kind") not in {"entity", "event", "value"}:
            raise GraphDemoViolation(f"{document}: unsupported node kind")
        if node["kind"] == "event" and not node.get("event_family"):
            raise GraphDemoViolation(f"{document}: Event nodes need event_family")
        confidence = node.get("confidence")
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            raise GraphDemoViolation(f"{document}: confidence must be between 0 and 1")

    for edge in edges:
        if edge.get("source_id") not in node_by_id or edge.get("target_id") not in node_by_id:
            raise GraphDemoViolation(f"{document}: edge endpoint does not exist")
    for qualifier in qualifiers:
        if qualifier.get("target_id") not in node_by_id:
            raise GraphDemoViolation(f"{document}: qualifier target does not exist")
        if qualifier.get("type") not in QUALIFIER_TYPES:
            raise GraphDemoViolation(f"{document}: unsupported qualifier type")

    qualifier_types_by_target: dict[str, set[str]] = defaultdict(set)
    for qualifier in qualifiers:
        qualifier_types_by_target[qualifier["target_id"]].add(qualifier["type"])
        if qualifier.get("value") == "unknown":
            raise GraphDemoViolation(
                f"{document}: oracle demo qualifiers must be adjudicated, not unknown"
            )
    for node in nodes:
        if node["kind"] != "event":
            continue
        missing = REQUIRED_EVENT_QUALIFIERS - qualifier_types_by_target[node["id"]]
        if missing:
            raise GraphDemoViolation(
                f"{document}: Event {node['id']} is missing qualifier {sorted(missing)[0]}"
            )

    coverage = graph.get("coverage")
    if not isinstance(coverage, Mapping):
        raise GraphDemoViolation(f"{document}: coverage must be an object")
    ratio = coverage.get("parsed_character_ratio")
    if isinstance(ratio, bool) or not isinstance(ratio, (int, float)) or not 0 <= ratio <= 1:
        raise GraphDemoViolation(f"{document}: parsed_character_ratio must be between 0 and 1")
    if not isinstance(coverage.get("unparsed_spans"), list):
        raise GraphDemoViolation(f"{document}: unparsed_spans must be an array")

    span_count = _validate_evidence_spans(all_elements, case, document)
    return {
        "graph_id": graph["graph_id"],
        "status": "valid",
        "node_count": len(nodes),
        "edge_count": len(edges),
        "qualifier_count": len(qualifiers),
        "evidence_span_count": span_count,
        "coverage": dict(coverage),
        "errors": [],
    }


def _groups_by_key(graph: Mapping[str, Any], *, events: bool) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for node in graph["nodes"]:
        is_event = node["kind"] == "event"
        if is_event != events:
            continue
        key_name = "alignment_key" if events else "canonical_key"
        groups[node[key_name]].append(node["id"])
    return groups


def align_graphs(source: Mapping[str, Any], translation: Mapping[str, Any]) -> dict[str, Any]:
    output: dict[str, Any] = {
        "source_graph_id": source["graph_id"],
        "translation_graph_id": translation["graph_id"],
    }
    unaligned_source: list[str] = []
    unaligned_translation: list[str] = []

    for label, events in (("entity_value_alignments", False), ("event_alignments", True)):
        source_groups = _groups_by_key(source, events=events)
        translation_groups = _groups_by_key(translation, events=events)
        alignments = []
        for key in sorted(source_groups.keys() & translation_groups.keys()):
            source_ids = sorted(source_groups[key])
            translation_ids = sorted(translation_groups[key])
            alignments.append(
                {
                    "alignment_id": f"align-{key}",
                    "semantic_unit_id": key,
                    "source_ids": source_ids,
                    "translation_ids": translation_ids,
                    "cardinality": f"{len(source_ids)}:{len(translation_ids)}",
                    "score": 1.0,
                    "status": "aligned",
                    "excluded_features": list(EVENT_EXCLUDED_FEATURES if events else ("surface",)),
                }
            )
        for key in sorted(source_groups.keys() - translation_groups.keys()):
            unaligned_source.extend(sorted(source_groups[key]))
        for key in sorted(translation_groups.keys() - source_groups.keys()):
            unaligned_translation.extend(sorted(translation_groups[key]))
        output[label] = alignments

    output["unaligned_source_ids"] = sorted(unaligned_source)
    output["unaligned_translation_ids"] = sorted(unaligned_translation)
    return output


def _node_map(graph: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    return {node["id"]: node for node in graph["nodes"]}


def _event_roles(graph: Mapping[str, Any], event_ids: set[str]) -> dict[str, set[str]]:
    nodes = _node_map(graph)
    roles: dict[str, set[str]] = defaultdict(set)
    for edge in graph["edges"]:
        if edge["source_id"] in event_ids and edge["type"] in ROLE_EDGES:
            target = nodes[edge["target_id"]]
            roles[edge["type"]].add(target["canonical_key"])
    return roles


def _event_qualifiers(
    graph: Mapping[str, Any], event_ids: set[str]
) -> tuple[dict[str, set[str]], dict[str, list[Mapping[str, Any]]]]:
    values: dict[str, set[str]] = defaultdict(set)
    by_type: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for qualifier in graph["qualifiers"]:
        if qualifier["target_id"] in event_ids:
            values[qualifier["type"]].add(qualifier["value"])
            by_type[qualifier["type"]].append(qualifier)
    return values, by_type


def _event_temporal_values(
    graph: Mapping[str, Any], event_ids: set[str]
) -> tuple[dict[str, set[str]], dict[str, list[Mapping[str, Any]]]]:
    nodes = _node_map(graph)
    values: dict[str, set[str]] = defaultdict(set)
    by_type: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for edge in graph["edges"]:
        if edge["source_id"] not in event_ids or edge["type"] not in TEMPORAL_VALUE_EDGES:
            continue
        target = nodes[edge["target_id"]]
        values[edge["type"]].add(target.get("normalized", target["canonical_key"]))
        by_type[edge["type"]].append(edge)
    return values, by_type


def _reporting_context(
    graph: Mapping[str, Any], content_event_ids: set[str]
) -> dict[str, Any]:
    nodes = _node_map(graph)
    report_edges = [
        edge
        for edge in graph["edges"]
        if edge["type"] == "REPORTS" and edge["target_id"] in content_event_ids
    ]
    report_event_ids = {edge["source_id"] for edge in report_edges}
    actor_edges = [
        edge
        for edge in graph["edges"]
        if edge["type"] == "ACTOR" and edge["source_id"] in report_event_ids
    ]
    reporter_node_ids = {edge["target_id"] for edge in actor_edges}
    reporter_keys = {
        nodes[node_id]["canonical_key"] for node_id in reporter_node_ids
    }
    evidence_elements = [
        *(nodes[event_id] for event_id in sorted(report_event_ids)),
        *report_edges,
        *actor_edges,
    ]
    return {
        "report_event_ids": sorted(report_event_ids),
        "reporter_node_ids": sorted(reporter_node_ids),
        "reporter_keys": sorted(reporter_keys),
        "element_ids": sorted(
            [*report_event_ids, *reporter_node_ids]
            + [edge["id"] for edge in report_edges]
            + [edge["id"] for edge in actor_edges]
        ),
        "evidence_spans": [
            span for element in evidence_elements for span in element["evidence_spans"]
        ],
    }


def _union_span(
    spans: Sequence[Mapping[str, Any]], case: VerificationCase, document: str
) -> dict[str, Any]:
    if not spans:
        raise GraphDemoViolation(f"{document}: cannot create evidence from an empty span list")
    start = min(span["start"] for span in spans)
    end = max(span["end"] for span in spans)
    text = case.source.text if document == "source" else case.translation.text
    return {
        "document": document,
        "unit_id": f"{document}:0",
        "start": start,
        "end": end,
        "quote": text[start:end],
    }


def _event_spans(
    graph: Mapping[str, Any], event_ids: set[str], case: VerificationCase, document: str
) -> dict[str, Any]:
    nodes = _node_map(graph)
    spans = [span for event_id in event_ids for span in nodes[event_id]["evidence_spans"]]
    return _union_span(spans, case, document)


def _candidate(
    *,
    case: VerificationCase,
    alignment: Mapping[str, Any],
    finding_type: str,
    change: str,
    severity: str,
    source_span: Mapping[str, Any],
    translation_span: Mapping[str, Any],
    source_element_ids: Sequence[str],
    translation_element_ids: Sequence[str],
    rationale: str,
    details: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    candidate_id = (
        f"candidate-{case.case_id}-{alignment['semantic_unit_id']}-{finding_type}"
    )
    return {
        "candidate_id": candidate_id,
        "semantic_unit_id": alignment["semantic_unit_id"],
        "alignment_id": alignment["alignment_id"],
        "type": finding_type,
        "change": change,
        "predicted_severity": severity,
        "source_element_ids": sorted(source_element_ids),
        "translation_element_ids": sorted(translation_element_ids),
        "source_span": dict(source_span),
        "translation_span": dict(translation_span),
        "confidence": 1.0,
        "rationale": rationale,
        "details": dict(details or {}),
    }


def compare_graphs(
    source: Mapping[str, Any],
    translation: Mapping[str, Any],
    alignments: Mapping[str, Any],
    case: VerificationCase,
) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    preserved: list[dict[str, Any]] = []
    suppressed_reporting_events: set[str] = set()

    for alignment in alignments["event_alignments"]:
        source_ids = set(alignment["source_ids"])
        translation_ids = set(alignment["translation_ids"])
        source_roles = _event_roles(source, source_ids)
        translation_roles = _event_roles(translation, translation_ids)
        source_qualifiers, source_qualifier_elements = _event_qualifiers(source, source_ids)
        translation_qualifiers, translation_qualifier_elements = _event_qualifiers(
            translation, translation_ids
        )
        source_temporal, source_temporal_edges = _event_temporal_values(source, source_ids)
        translation_temporal, translation_temporal_edges = _event_temporal_values(
            translation, translation_ids
        )
        source_reporting = _reporting_context(source, source_ids)
        translation_reporting = _reporting_context(translation, translation_ids)
        source_event_span = _event_spans(source, source_ids, case, "source")
        translation_event_span = _event_spans(
            translation, translation_ids, case, "translation"
        )
        changed: list[str] = []

        if (
            source_roles.get("ACTOR") == translation_roles.get("TARGET")
            and source_roles.get("TARGET") == translation_roles.get("ACTOR")
            and source_roles.get("ACTOR")
            and source_roles.get("TARGET")
        ):
            changed.append("ACTOR/TARGET")
            candidates.append(
                _candidate(
                    case=case,
                    alignment=alignment,
                    finding_type="actor_role_change",
                    change="swapped",
                    severity="critical",
                    source_span=source_event_span,
                    translation_span=translation_event_span,
                    source_element_ids=source_ids,
                    translation_element_ids=translation_ids,
                    rationale="The aligned event reverses its ACTOR and TARGET roles.",
                )
            )

        qualifier_rules = (
            ("polarity", "negation_flip", "The aligned claim changes polarity."),
            ("certainty", "certainty_shift", "The aligned claim changes certainty."),
        )
        for qualifier_type, finding_type, rationale in qualifier_rules:
            source_values = source_qualifiers.get(qualifier_type, set())
            translation_values = translation_qualifiers.get(qualifier_type, set())
            if not source_values or not translation_values or source_values == translation_values:
                continue
            changed.append(qualifier_type)
            source_elements = source_qualifier_elements[qualifier_type]
            translation_elements = translation_qualifier_elements[qualifier_type]
            candidates.append(
                _candidate(
                    case=case,
                    alignment=alignment,
                    finding_type=finding_type,
                    change="changed",
                    severity="high",
                    source_span=_union_span(
                        [span for item in source_elements for span in item["evidence_spans"]],
                        case,
                        "source",
                    ),
                    translation_span=_union_span(
                        [span for item in translation_elements for span in item["evidence_spans"]],
                        case,
                        "translation",
                    ),
                    source_element_ids=[item["id"] for item in source_elements],
                    translation_element_ids=[item["id"] for item in translation_elements],
                    rationale=rationale,
                )
            )

        source_evidentiality = source_qualifiers.get("evidentiality", set())
        translation_evidentiality = translation_qualifiers.get("evidentiality", set())
        reporting_changed = (
            source_reporting["reporter_keys"] != translation_reporting["reporter_keys"]
            or bool(source_reporting["report_event_ids"])
            != bool(translation_reporting["report_event_ids"])
            or source_evidentiality != translation_evidentiality
        )
        if reporting_changed:
            changed.append("source_attribution")
            source_evidence = source_reporting["evidence_spans"] or [source_event_span]
            translation_evidence = translation_reporting["evidence_spans"] or [
                translation_event_span
            ]
            source_qualifier_ids = [
                item["id"]
                for item in source_qualifier_elements.get("evidentiality", [])
            ]
            translation_qualifier_ids = [
                item["id"]
                for item in translation_qualifier_elements.get("evidentiality", [])
            ]
            candidates.append(
                _candidate(
                    case=case,
                    alignment=alignment,
                    finding_type="source_attribution_change",
                    change="changed",
                    severity="high",
                    source_span=_union_span(source_evidence, case, "source"),
                    translation_span=_union_span(
                        translation_evidence, case, "translation"
                    ),
                    source_element_ids=(
                        source_reporting["element_ids"]
                        + source_qualifier_ids
                        + sorted(source_ids)
                    ),
                    translation_element_ids=(
                        translation_reporting["element_ids"]
                        + translation_qualifier_ids
                        + sorted(translation_ids)
                    ),
                    rationale=(
                        "The aligned content changes its reporting frame, reporter, "
                        "or evidentiality mode."
                    ),
                    details={
                        "source_reporters": source_reporting["reporter_keys"],
                        "translation_reporters": translation_reporting["reporter_keys"],
                        "source_evidentiality": sorted(source_evidentiality),
                        "translation_evidentiality": sorted(translation_evidentiality),
                    },
                )
            )
            suppressed_reporting_events.update(source_reporting["report_event_ids"])

        changed_temporal_types: list[str] = []
        changed_source_edges: list[Mapping[str, Any]] = []
        changed_translation_edges: list[Mapping[str, Any]] = []
        for edge_type in sorted(TEMPORAL_VALUE_EDGES):
            source_values = source_temporal.get(edge_type, set())
            translation_values = translation_temporal.get(edge_type, set())
            if source_values == translation_values:
                continue
            changed_temporal_types.append(edge_type)
            changed_source_edges.extend(source_temporal_edges.get(edge_type, []))
            changed_translation_edges.extend(translation_temporal_edges.get(edge_type, []))

        if changed_temporal_types:
            changed.extend(changed_temporal_types)
            candidates.append(
                _candidate(
                    case=case,
                    alignment=alignment,
                    finding_type="temporal_change",
                    change="changed",
                    severity="high",
                    source_span=(
                        _union_span(
                            [
                                span
                                for item in changed_source_edges
                                for span in item["evidence_spans"]
                            ],
                            case,
                            "source",
                        )
                        if changed_source_edges
                        else source_event_span
                    ),
                    translation_span=(
                        _union_span(
                            [
                                span
                                for item in changed_translation_edges
                                for span in item["evidence_spans"]
                            ],
                            case,
                            "translation",
                        )
                        if changed_translation_edges
                        else translation_event_span
                    ),
                    source_element_ids=(
                        [item["id"] for item in changed_source_edges]
                        or sorted(source_ids)
                    ),
                    translation_element_ids=(
                        [item["id"] for item in changed_translation_edges]
                        or sorted(translation_ids)
                    ),
                    rationale=(
                        "The aligned event changes temporal value(s): "
                        + ", ".join(changed_temporal_types)
                        + "."
                    ),
                    details={"changed_temporal_edges": changed_temporal_types},
                )
            )

        if not changed:
            preserved.append(
                {
                    "semantic_unit_id": alignment["semantic_unit_id"],
                    "alignment_id": alignment["alignment_id"],
                    "cardinality": alignment["cardinality"],
                    "preserved_features": [
                        "participant_roles",
                        "polarity",
                        "certainty",
                        "evidentiality",
                        "temporal_values",
                    ],
                }
            )

    return {
        "candidate_diffs": sorted(candidates, key=lambda item: item["candidate_id"]),
        "preserved_units": preserved,
        "suppressed_generic_omissions": sorted(suppressed_reporting_events),
    }


def confirm_candidates(
    comparison: Mapping[str, Any],
    expected_decisions: Mapping[str, Any],
    case: VerificationCase,
) -> dict[str, Any]:
    if not isinstance(expected_decisions, Mapping):
        raise GraphDemoViolation("confirmations must be an object keyed by finding type")
    candidate_types = {item["type"] for item in comparison["candidate_diffs"]}
    if candidate_types != set(expected_decisions):
        raise GraphDemoViolation(
            "confirmations must define exactly one decision for every candidate type"
        )
    decisions = []
    for candidate in comparison["candidate_diffs"]:
        decision = expected_decisions[candidate["type"]]
        if decision not in {"confirmed", "rejected", "abstained"}:
            raise GraphDemoViolation(f"unsupported confirmation decision: {decision!r}")
        _to_span(candidate["source_span"]).validate_against(
            case, expected_document="source"
        )
        _to_span(candidate["translation_span"]).validate_against(
            case, expected_document="translation"
        )
        decisions.append(
            {
                "candidate_id": candidate["candidate_id"],
                "decision": decision,
                "confidence": candidate["confidence"] if decision != "abstained" else None,
                "mode": "scripted_oracle_confirmation",
                "evidence_checks": ["source_span_exact", "translation_span_exact"],
            }
        )
    return {
        "called": bool(decisions),
        "mode": "scripted_oracle_confirmation",
        "note": "This demo uses hand-authored expected judgments; it is not a learned confirmer.",
        "decisions": decisions,
    }


def _to_span(raw: Mapping[str, Any]) -> EvidenceSpan:
    return EvidenceSpan.from_mapping(raw, "demo.finding.evidence")


def findings_from_candidates(
    comparison: Mapping[str, Any], confirmation: Mapping[str, Any], case: VerificationCase
) -> tuple[Finding, ...]:
    decision_by_id = {
        item["candidate_id"]: item["decision"] for item in confirmation["decisions"]
    }
    grouped: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for candidate in comparison["candidate_diffs"]:
        if decision_by_id.get(candidate["candidate_id"]) in {"confirmed", "abstained"}:
            grouped[candidate["semantic_unit_id"]].append(candidate)

    findings = []
    for index, semantic_unit_id in enumerate(sorted(grouped), start=1):
        candidates = grouped[semantic_unit_id]
        primary = min(candidates, key=lambda item: TYPE_PRIORITY[item["type"]])
        source_span = _union_span(
            [item["source_span"] for item in candidates], case, "source"
        )
        translation_span = _union_span(
            [item["translation_span"] for item in candidates], case, "translation"
        )
        severity = max(
            (item["predicted_severity"] for item in candidates),
            key=lambda value: SEVERITY_RANK[value],
        )
        status = (
            "abstained"
            if any(
                decision_by_id[item["candidate_id"]] == "abstained"
                for item in candidates
            )
            else "confirmed"
        )
        findings.append(
            Finding(
                finding_id=f"finding-{case.case_id}-{index:02d}",
                type=primary["type"],
                related_types=tuple(
                    sorted(
                        {
                            item["type"]
                            for item in candidates
                            if item["type"] != primary["type"]
                        }
                    )
                ),
                change=primary["change"],
                severity=severity,
                source_span=_to_span(source_span),
                translation_span=_to_span(translation_span),
                evidence_absence_reason=None,
                confidence=(
                    None
                    if status == "abstained"
                    else min(item["confidence"] for item in candidates)
                ),
                status=status,
                detectors=(Component(id=STRATEGY_ID, version=STRATEGY_VERSION),),
                rationale=" ".join(item["rationale"] for item in candidates),
            )
        )
    return tuple(findings)


@dataclass
class ScriptedGraphStrategy:
    findings: Sequence[Finding]
    strategy_id: str = STRATEGY_ID
    version: str = STRATEGY_VERSION

    def detect(self, case: VerificationCase) -> Sequence[Finding]:
        return tuple(self.findings)


def _dataset_digest(spec: Mapping[str, Any]) -> str:
    encoded = json.dumps(
        spec, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _git_commit(workdir: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=workdir,
            check=True,
            capture_output=True,
            text=True,
        )
        value = result.stdout.strip().lower()
        if 7 <= len(value) <= 40 and all(character in "0123456789abcdef" for character in value):
            return value
    except (OSError, subprocess.SubprocessError):
        pass
    return "0000000"


def load_demo_spec(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise GraphDemoViolation("demo root must be an object")
    _strict_keys(
        value,
        required={"demo_version", "mode", "cases"},
        optional=set(),
        path="demo",
    )
    if value["demo_version"] != DEMO_VERSION:
        raise GraphDemoViolation(f"demo_version must equal {DEMO_VERSION}")
    if value["mode"] != "hand_authored_oracle":
        raise GraphDemoViolation("mode must be hand_authored_oracle")
    if not isinstance(value["cases"], list) or not value["cases"]:
        raise GraphDemoViolation("cases must be a non-empty array")
    return value


def run_demo_case(
    raw: Mapping[str, Any], *, dataset_digest: str, git_commit: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    _strict_keys(
        raw,
        required={"title", "purpose", "case", "graphs", "confirmations"},
        optional=set(),
        path="demo.case",
    )
    case = VerificationCase.from_mapping(raw["case"])
    graphs_raw = raw["graphs"]
    _strict_keys(
        graphs_raw,
        required={"source", "translation"},
        optional=set(),
        path=f"demo.case.{case.case_id}.graphs",
    )
    source_graph = materialize_graph(graphs_raw["source"], case, "source")
    translation_graph = materialize_graph(
        graphs_raw["translation"], case, "translation"
    )
    validation = {
        "source": validate_graph(source_graph, case, "source"),
        "translation": validate_graph(translation_graph, case, "translation"),
    }
    alignments = align_graphs(source_graph, translation_graph)
    comparison = compare_graphs(source_graph, translation_graph, alignments, case)
    confirmation = confirm_candidates(comparison, raw["confirmations"], case)
    findings = findings_from_candidates(comparison, confirmation, case)

    run_id = f"demo-run-{case.case_id}"
    fixed_now = lambda: datetime(2026, 10, 12, 0, 0, tzinfo=timezone.utc)
    pipeline = VerificationPipeline(
        ScriptedGraphStrategy(findings),
        pipeline_version="graph-demo-1.0",
        now=fixed_now,
        monotonic=lambda: 100.0,
        id_factory=lambda: run_id,
    )
    report = pipeline.run(
        case.to_dict(),
        dataset_version="graph-demo-1.0",
        dataset_digest=dataset_digest,
        git_commit=git_commit,
        options={"mode": "hand_authored_oracle"},
        random_seed=0,
        hardware_class="model-free-local",
        run_id=run_id,
    )

    trace = {
        "trace_version": DEMO_VERSION,
        "run_id": report.run_id,
        "case_id": case.case_id,
        "title": raw["title"],
        "purpose": raw["purpose"],
        "mode": "hand_authored_oracle",
        "model_used": False,
        "modules": {
            "M0_input_contract": {"input": raw["case"], "output": case.to_dict()},
            "M1_graph_extractor": {
                "implementation": "fixture_lookup_stub",
                "input": [
                    {
                        "call_id": "extract-source",
                        "document": "source",
                        "payload": case.source.to_dict(),
                    },
                    {
                        "call_id": "extract-translation",
                        "document": "translation",
                        "payload": case.translation.to_dict(),
                    },
                ],
                "output": {"source_graph": source_graph, "translation_graph": translation_graph},
            },
            "M2_graph_validator": {
                "input": {
                    "source_graph": source_graph,
                    "translation_graph": translation_graph,
                    "source_text": case.source.text,
                    "translation_text": case.translation.text,
                },
                "output": validation,
            },
            "M3_cross_lingual_aligner": {
                "input": {
                    "source_graph": source_graph,
                    "translation_graph": translation_graph,
                },
                "output": alignments,
            },
            "M4_typed_comparator": {
                "input": {
                    "source_graph": source_graph,
                    "translation_graph": translation_graph,
                    "alignments": alignments,
                },
                "output": comparison,
            },
            "M5_targeted_confirmer": {
                "input": {
                    "candidates": comparison["candidate_diffs"],
                    "source": case.source.to_dict(),
                    "translation": case.translation.to_dict(),
                    "oracle_decision_table": dict(raw["confirmations"]),
                },
                "output": confirmation,
            },
            "M6_report_adapter": {
                "input": [item.to_dict() for item in findings],
                "output": {
                    "report_status": report.status,
                    "finding_ids": [item.finding_id for item in report.findings],
                    "strict_contract": "VerificationReport v1",
                },
            },
        },
    }
    return trace, report.to_dict()


def run_demo_file(path: Path, *, git_commit: str | None = None) -> list[dict[str, Any]]:
    spec = load_demo_spec(path)
    digest = _dataset_digest(spec)
    resolved_commit = git_commit or _git_commit(path.parent)
    results = []
    for raw_case in spec["cases"]:
        trace, report = run_demo_case(
            raw_case, dataset_digest=digest, git_commit=resolved_commit
        )
        results.append({"trace": trace, "report": report})
    return results


def _summary(result: Mapping[str, Any]) -> str:
    trace = result["trace"]
    report = result["report"]
    modules = trace["modules"]
    validation = modules["M2_graph_validator"]["output"]
    alignments = modules["M3_cross_lingual_aligner"]["output"]
    comparison = modules["M4_typed_comparator"]["output"]
    types = [item["type"] for item in comparison["candidate_diffs"]]
    cardinalities = [item["cardinality"] for item in alignments["event_alignments"]]
    report_types = [
        "+".join([item["type"], *item["related_types"]]) for item in report["findings"]
    ]
    return "\n".join(
        (
            f"[{trace['case_id']}] {trace['title']}",
            f"  M1 extractor : hand-authored graphs (model_used={trace['model_used']})",
            "  M2 validator : "
            f"source={validation['source']['status']}, translation={validation['translation']['status']}",
            f"  M3 aligner   : event cardinalities={cardinalities}",
            f"  M4 comparator: candidate types={types}",
            f"  M5 confirmer : called={modules['M5_targeted_confirmer']['output']['called']}",
            f"  M6 report    : status={report['status']}, findings={report_types}",
        )
    )


def write_outputs(results: Sequence[Mapping[str, Any]], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for result in results:
        case_id = result["trace"]["case_id"]
        for artifact in ("trace", "report"):
            path = output_dir / f"{case_id}.{artifact}.json"
            path.write_text(
                json.dumps(result[artifact], ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )


def main(default_spec: Path | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the model-free DARI graph demo")
    parser.add_argument(
        "--spec",
        type=Path,
        default=default_spec,
        required=default_spec is None,
        help="Path to demo_cases.json",
    )
    parser.add_argument("--full", action="store_true", help="Print full trace and report JSON")
    parser.add_argument("--output-dir", type=Path, help="Write trace/report JSON files")
    args = parser.parse_args()
    results = run_demo_file(args.spec)
    if args.output_dir:
        write_outputs(results, args.output_dir)
    if args.full:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print("\n\n".join(_summary(result) for result in results))


__all__ = [
    "GraphDemoViolation",
    "align_graphs",
    "compare_graphs",
    "load_demo_spec",
    "main",
    "materialize_graph",
    "run_demo_case",
    "run_demo_file",
    "validate_graph",
    "write_outputs",
]
