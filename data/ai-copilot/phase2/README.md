# Pixiu CyberLab AI Copilot — Phase 2 Dataset Corpus

This directory contains the verified dataset pipeline, canonical representations, evaluation splits, and quality reports for the Pixiu AI Copilot.

## Directory Layout

```
data/ai-copilot/phase2/
├── README.md               # This documentation
├── manifest.json           # Cryptographic release manifest with SHA-256 hashes
├── records/
│   ├── canonical.jsonl     # Extracted canonical ground-truth circuits
│   ├── requests.jsonl      # Task Group 1: Student request paraphrases (355 records)
│   ├── fault-repairs.jsonl # Task Group 2: Controlled fault/repair pairs (175 records)
│   ├── diagnosis-explanations.jsonl # Task Group 3: Telemetry-grounded diagnostics (142 records)
│   └── blockly-code.jsonl  # Task Group 4: Verified Blockly XML programs (142 records)
├── splits/
│   ├── train.jsonl         # Training partition (531 records, 44 families)
│   ├── validation.jsonl    # Validation partition (144 records, 11 families)
│   └── test.jsonl          # Held-out evaluation partition (139 records, 11 families)
└── reports/
    ├── source-inventory.json   # Full inventory of scanned templates and missions
    ├── duplicate-audit.json    # Deduplication and topology equivalence report
    ├── leakage-audit.json      # Cross-split family and paraphrase isolation audit
    ├── validation-report.json  # Gate G1–G10 verification scores
    └── release-summary.md      # Human-readable release documentation
```

## Reproduction Pipeline

To re-build and verify the dataset from scratch:

```bash
# 1. Run complete dataset build & QA gate check
npm run qa:copilot-dataset

# 2. Or run individual pipeline stages
node scripts/copilot-dataset/inventory-sources.mjs
node scripts/copilot-dataset/extract-candidates.mjs
node scripts/copilot-dataset/generate-request-variants.mjs
node scripts/copilot-dataset/generate-fault-repair-pairs.mjs
node scripts/copilot-dataset/generate-diagnosis-and-code.mjs
node scripts/copilot-dataset/split-by-family.mjs
node scripts/copilot-dataset/build-release-report.mjs
```
