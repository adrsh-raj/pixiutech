# Pixiu CyberLab AI Copilot — Phase 2 Dataset Corpus

This directory contains the verified dataset pipeline, canonical records, isolated evaluation splits, and quality reports.

## Corpus counts
- Canonical circuits: 71
- Request variants: 355 (five explicit linguistic styles)
- Fault/repair pairs: 175
- Diagnosis explanations: 142
- Well-formed Blockly XML examples: 124
- Released records across splits: 796
- Project families: 66

## Rebuild and verify
Run the generator stages in order, then run `npm run build:copilot-dataset` and `npm run qa:copilot-dataset`. QA checks exact expected diagnostic rule IDs and severity, source provenance, style/topology invariants, all-pair split isolation, task-specific SHA-256 digests, and manifest artifact hashes.

Automated approval metadata is not independent human review.
