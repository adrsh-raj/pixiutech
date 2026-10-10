# Pixiu CyberLab AI Copilot — Phase 2 Release Summary

**Status:** Pending strict GitHub CI verification. Do not use for Phase 3 training until all checks pass.

## Corpus
- Canonical circuits: 71
- Request variants: 355 (five explicit linguistic styles)
- Fault/repair pairs: 175
- Diagnosis explanations: 142
- Well-formed Blockly XML examples: 124
- Released records: 796
- Project families: 66

## Splits
- Train: 516 (64.8%), 43 families
- Validation: 146 (18.3%), 12 families
- Test: 134 (16.8%), 11 families
- Exact topology overlap across all three split pairs: zero.

## Release gates
- G4 requires exact expected-rule and severity matching for every fault record.
- G7 independently checks record/family/parent/topology isolation across all split pairs.
- G8 recomputes record-level hashes and every manifest artifact SHA-256 and byte count.
- G9 records automated review metadata and does not imply human review.
