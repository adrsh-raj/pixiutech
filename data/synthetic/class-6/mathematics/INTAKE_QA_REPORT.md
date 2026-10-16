# Pixiu Tech — Class 6 Mathematics JSONL Intake QA

- Source file: `G6_Mathematics_v1.0_corrected(1).jsonl`
- Destination artifact: `data/synthetic/class-6/mathematics/G6_Mathematics_v1.0.jsonl`
- Intake date: 2026-10-17
- Intake status: **STRUCTURAL CHECKS PASS; SUBJECT-MATTER QA PENDING**
- Expected records: 1,400
- Parsed records: 1,400
- JSON parse errors: 0
- Unique example IDs: 1,400
- Duplicate example IDs: 0
- Required-field omissions across checked fields: 0
- Human review decision recorded in JSONL: **Pending for all 1,400 records**
- QA status recorded in JSONL: **Expert review needed for all 1,400 records**

## Per-topic record counts

Each listed topic has exactly 100 records:

| Topic ID | Topic | Records |
|---|---|---:|
| G6-MATH-001 | Knowing Our Numbers | 100 |
| G6-MATH-002 | Whole Numbers | 100 |
| G6-MATH-003 | Playing with Numbers | 100 |
| G6-MATH-004 | Basic Geometrical Ideas | 100 |
| G6-MATH-005 | Understanding Elementary Shapes | 100 |
| G6-MATH-006 | Integers | 100 |
| G6-MATH-007 | Fractions | 100 |
| G6-MATH-008 | Decimals | 100 |
| G6-MATH-009 | Data Handling | 100 |
| G6-MATH-010 | Mensuration | 100 |
| G6-MATH-011 | Algebra | 100 |
| G6-MATH-012 | Ratio and Proportion | 100 |
| G6-MATH-013 | Symmetry | 100 |
| G6-MATH-014 | Practical Geometry | 100 |

## Dataset split counts

- Train: 980
- Validation: 210
- Test: 210

## Example category counts

- Concept understanding: 210
- Real-life application: 210
- Misconceptions and corrective teaching: 280
- Step-by-step reasoning / problem solving: 210
- Diagram, graph, or virtual-lab reasoning: 210
- Follow-up / understanding checks: 140
- Challenge / edge cases: 140

## Important limitations

1. These checks establish parseability, counts, ID uniqueness and presence of required fields; they do **not** prove every mathematical answer or teaching explanation is correct.
2. The supplied JSONL itself has `reviewer_decision = Pending` and `qa_status = Expert review needed` for all 1,400 records. No approval labels were changed during intake.
3. This file is stored as a review candidate on a dedicated branch. Do not use it as an approved training release until the human-review record and subject-matter QA are reconciled and completed.
4. Exact/near-duplicate question similarity and mathematical correctness have not been exhaustively established by this structural intake check.
