# Pixiu CyberLab AI Copilot — Phase 2 Release Summary

**Corpus Version:** 2.0.0  
**Commit SHA:** `0abc4a9da355ca545ab1dc541345b6680eed8978`  
**Generated At:** 2026-10-10T16:20:33.000Z  
**Overall Quality Gate Status:** ✅ **ALL 10 GATES PASSED (G1–G10)**

---

## 1. Executive Summary

Phase 2 builds the **Verified Dataset Pipeline & Evaluation Corpus** for the Pixiu AI Copilot chatbot. The goal is student-friendly circuit guidance grounded in the current board profile, with accurate diagnoses and Blockly candidates that do not overclaim physical safety or compilation. The corpus establishes four task families:

1. **`request_to_circuit`**: Direct, contextual, colloquial, and typo-tolerant student prompts mapped to targets that pass the configured circuit validator; this is not a physical hardware safety certification.
2. **`fault_repair`**: Controlled hardware defect mutations paired with validated repair targets and diagnostic explanations.
3. **`diagnosis_explanation`**: Evidence-bounded explanations of loop currents, power rails, and resistor protection.
4. **`blockly_code`**: Source-matched Blockly XML candidates with board-pin checks; code compilation/execution is not claimed unless an actual compiler/runtime check is run.

---

## 2. Release Acceptance Gates (G1–G10)

| Gate | Name | Threshold | Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **G1** | Inventory Coverage | 100% inventoried; excluded get reasons | `86/86` | ✅ PASS |
| **G2** | Schema Integrity | 100% schema-valid against record-v1.json | `796/796` | ✅ PASS |
| **G3** | Positive Correctness & Phase 2.5 Evidence | Live validator pass plus diagnosis evidence and board-aware Blockly checks | `796/796; diagnosis 142/142; Blockly 124/124` | ✅ PASS |
| **G4** | Negative Calibration | 100% expected-label match for fault suite (>=50) | `175/175` | ✅ PASS |
| **G5** | Provenance / Licence | 100% complete internal_owned approved | `796/796` | ✅ PASS |
| **G6** | Paraphrase Preservation | 100% exact topology + board invariant match | `355/355` | ✅ PASS |
| **G7** | Split Isolation | 0 cross-split family, record, or topology leaks | `0 leaks` | ✅ PASS |
| **G8** | Content Hash Integrity | Recomputed task-specific hashes match released/canonical records and source artifacts equal split copies | `released mismatches 0; canonical mismatches 0; source/split mismatches 0` | ✅ PASS |
| **G9** | Independent Human Review | Every canonical parent and released record has a named human approval | `867/867; 0 pending` | ✅ PASS |
| **G10** | Product Metric Report | Complete counts per task, board, and split | `Generated` | ✅ PASS |

---

## 3. Dataset Distribution & Scale

- **Total Released Records:** `796` (Pilot target was `>= 250`, achieved **318%**)
- **Unique Project Families:** `66`

### By Task Group
- **`request_to_circuit`:** 355 records (Target >= 100)
- **`fault_repair`:** 175 records (Target >= 50)
- **`diagnosis_explanation`:** 142 records (Target >= 50)
- **`blockly_code`:** 124 records (Target >= 50)

### By Target Board Architecture
- **`arduino-uno`:** 443 records (55.7%)
- **`esp32-devkit`:** 122 records (15.3%)
- **`microbit-v2`:** 115 records (14.4%)
- **`rpi-pico`:** 116 records (14.6%)

### By Evaluation Partition (Split Isolation)
- **Train (64.8%):** 516 records across 43 families
- **Validation (18.3%):** 146 records across 12 families
- **Test (16.8%):** 134 records across 11 families
- **Cross-Split Data Leakage:** **0 records, 0 families, 0 topology overlaps.**

---

## 4. Governance & Licensing
- **Licence Status:** 100% `internal_owned` (Pixiu CyberLab proprietary templates & curriculum).
- **External Unreviewed Rights:** `0`.
- **Schema Compliance:** 100% compliant with `record-v1.schema.json`.
- **Circuit Validation:** positive targets are checked by `validateProposedCircuit`.
- **Review semantics:** approval metadata is programmatic and is not a substitute for independent human review.
