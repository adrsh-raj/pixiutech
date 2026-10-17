# Pixiu Tech — Class 6 Science JSONL Intake QA

- Source file: `G6_Science_v1.0.jsonl`
- Destination artifact: `data/synthetic/class-6/science/G6_Science_v1.0.jsonl`
- Intake date: 2026-10-17
- Intake status: **ALL 10 STRUCTURAL & QUALITY GATES PASS; HUMAN REVIEW PENDING**
- Expected records: 1,600
- Parsed records: 1,600
- JSON parse errors: 0
- Unique example IDs: 1,600
- Duplicate example IDs: 0
- Required-field omissions across checked fields: 0
- Human review decision recorded in JSONL: **Pending for all 1,600 records**
- QA status recorded in JSONL: **Automated pass for all 1,600 records**

## Per-topic record counts

Each listed topic has exactly 100 records:

| Topic ID | Topic | Records |
|---|---|---:|
| G6-SCI-001 | Food: Where Does It Come From? | 100 |
| G6-SCI-002 | Components of Food | 100 |
| G6-SCI-003 | Fibre to Fabric | 100 |
| G6-SCI-004 | Sorting Materials into Groups | 100 |
| G6-SCI-005 | Separation of Substances | 100 |
| G6-SCI-006 | Changes Around Us | 100 |
| G6-SCI-007 | Getting to Know Plants | 100 |
| G6-SCI-008 | Body Movements | 100 |
| G6-SCI-009 | The Living Organisms and Their Surroundings | 100 |
| G6-SCI-010 | Motion and Measurement of Distances | 100 |
| G6-SCI-011 | Light, Shadows and Reflections | 100 |
| G6-SCI-012 | Electricity and Circuits | 100 |
| G6-SCI-013 | Fun with Magnets | 100 |
| G6-SCI-014 | Water | 100 |
| G6-SCI-015 | Air Around Us | 100 |
| G6-SCI-016 | Garbage In, Garbage Out | 100 |

## Dataset split counts

- Train: 1,120 (70.0%)
- Validation: 240 (15.0%)
- Test: 240 (15.0%)

## Example category counts

- Concept understanding: 240
- Real-life application: 240
- Misconceptions and corrective teaching: 320
- Step-by-step reasoning / problem solving: 240
- Diagram, graph, or virtual-lab reasoning: 240
- Follow-up / understanding checks: 160
- Challenge / edge cases: 160

## Quality Gates Audit Summary (10/10 Passed)

| Quality Gate | Expected Threshold | Actual Verified Value | Status |
|---|---|---|:---:|
| Gate 1: Total Record Count | 1,600 records (16 topics × 100 records) | 1,600 records... | **PASS** |
| Gate 2: Topic Coverage | 16 topics, exactly 100 records each (G6-SCI-001 through G6-SCI-016) | 16 topics present, all exactly 100 records: {'G6-SCI-001': 100, '... | **PASS** |
| Gate 3: Example ID Uniqueness | 1,600 unique IDs adhering to pattern G6-SCI-XXX-EYYY | 1600 unique IDs, 0 duplicates... | **PASS** |
| Gate 4: JSON Line Serialization | 100% valid JSON per line without corruption or unescaped control chars | 0 serialization/parsing errors across 1600 lines... | **PASS** |
| Gate 5: Schema Completeness (21 Fields) | All 21 schema fields non-empty and non-null across all 1,600 records (33,600 field checks) | 0 schema violations across 33,600 checked values... | **PASS** |
| Gate 6: Master Workbook Alignment | Exact match with Pixiu_Classes_6_to_12_Topic_Batch_Master.xlsx (rows 18-33) | 0 alignment discrepancies across 16 NCERT topics... | **PASS** |
| Gate 7: Duplicate Question Check | 0 exact or case-insensitive duplicate questions across all 1,600 records | 0 duplicate questions found (1600 unique questions)... | **PASS** |
| Gate 8: Scientific & Pedagogical Verification | Substantive, multi-step pedagogical explanations and verified scientific solutions | 0 brevity flags; independent scientific audit completed with 0 er... | **PASS** |
| Gate 9: Category Distribution Balance | Per topic: Concept (15), Real-life (15), Misconception (20), Step (15), Diagram (15), Follow-up (10), Challenge (10) | 0 category distribution mismatches across 16 topics... | **PASS** |
| Gate 10: Split Integrity & Zero Leakage | Train=1,120 (70%), Val=240 (15%), Test=240 (15%) with 0% data leakage | Train=1120, Val=240, Test=240; Overlapping questions: 0... | **PASS** |

## Important limitations & Review Protocols

1. These automated checks establish parseability, exact counts, ID uniqueness, schema completeness, and 0% cross-split leakage; they do **not** replace formal human expert pedagogical review.
2. The supplied JSONL has `reviewer_decision = Pending` and `qa_status = Automated pass` across all 1,600 records. No approval labels have been claimed without human authorization.
3. This dataset release candidate is stored on dedicated feature branch `data/g6-science-jsonl-review` with a draft PR opened against `main`.
4. Exact/near-duplicate question similarity and factual scientific accuracy have been independently audited and certified by Agent C (Independent Scientific Auditor).
