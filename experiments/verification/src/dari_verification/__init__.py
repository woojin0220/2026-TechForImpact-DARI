"""Experiment-only contracts and orchestration for DARI verification research."""

from .contracts import (
    Component,
    ContractViolation,
    EvidenceSpan,
    Finding,
    Provenance,
    ReportError,
    VerificationCase,
    VerificationReport,
)
from .pipeline import (
    MalformedStrategyOutput,
    StrategyFailure,
    StrategyTimeout,
    UnsupportedLanguage,
    VerificationPipeline,
)
from .batch import run_batch
from .fixtures import (
    Fixture,
    FixtureProvenance,
    GoldFinding,
    compute_dataset_digest,
    load_fixture_lines,
    load_fixtures,
)

__all__ = [
    "Component",
    "ContractViolation",
    "EvidenceSpan",
    "Fixture",
    "FixtureProvenance",
    "Finding",
    "GoldFinding",
    "MalformedStrategyOutput",
    "Provenance",
    "ReportError",
    "StrategyFailure",
    "StrategyTimeout",
    "UnsupportedLanguage",
    "VerificationCase",
    "VerificationPipeline",
    "VerificationReport",
    "compute_dataset_digest",
    "load_fixture_lines",
    "load_fixtures",
    "run_batch",
]
