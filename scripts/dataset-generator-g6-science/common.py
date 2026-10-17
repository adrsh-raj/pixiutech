"""Common utilities and schema validator for Class 6 Science synthetic dataset."""

CATEGORIES = [
    "Concept understanding",
    "Real-life application",
    "Misconceptions and corrective teaching",
    "Step-by-step reasoning / problem solving",
    "Diagram, graph, or virtual-lab reasoning",
    "Follow-up / understanding checks",
    "Challenge / edge cases"
]

CATEGORY_TARGETS = {
    "Concept understanding": 15,
    "Real-life application": 15,
    "Misconceptions and corrective teaching": 20,
    "Step-by-step reasoning / problem solving": 15,
    "Diagram, graph, or virtual-lab reasoning": 15,
    "Follow-up / understanding checks": 10,
    "Challenge / edge cases": 10
}

TOPIC_MAP = {
    "G6-SCI-001": "Food: Where Does It Come From?",
    "G6-SCI-002": "Components of Food",
    "G6-SCI-003": "Fibre to Fabric",
    "G6-SCI-004": "Sorting Materials into Groups",
    "G6-SCI-005": "Separation of Substances",
    "G6-SCI-006": "Changes Around Us",
    "G6-SCI-007": "Getting to Know Plants",
    "G6-SCI-008": "Body Movements",
    "G6-SCI-009": "The Living Organisms and Their Surroundings",
    "G6-SCI-010": "Motion and Measurement of Distances",
    "G6-SCI-011": "Light, Shadows and Reflections",
    "G6-SCI-012": "Electricity and Circuits",
    "G6-SCI-013": "Fun with Magnets",
    "G6-SCI-014": "Water",
    "G6-SCI-015": "Air Around Us",
    "G6-SCI-016": "Garbage In, Garbage Out"
}

def make_record(
    topic_id: str,
    index: int,
    subtopic: str,
    example_category: str,
    student_question: str,
    student_context_or_attempt: str,
    expected_answer: str,
    teaching_response: str,
    worked_steps: str,
    misconception_target: str,
    analogy_or_real_life_example: str,
    diagram_or_lab_mode: str,
    follow_up_question: str,
    expected_teaching_behaviour: str,
    split: str = "Train",
    qa_status: str = "Automated pass",
    reviewer_decision: str = "Pending"
) -> dict:
    assert topic_id in TOPIC_MAP, f"Invalid topic_id: {topic_id}"
    assert 1 <= index <= 100, f"Index must be 1..100, got {index}"
    assert example_category in CATEGORIES, f"Invalid category: {example_category}"
    assert diagram_or_lab_mode in ["None", "Diagram", "Graph", "Virtual Lab", "Physical activity"], f"Invalid mode: {diagram_or_lab_mode}"
    assert split in ["Train", "Validation", "Test"], f"Invalid split: {split}"

    example_id = f"{topic_id}-E{index:03d}"
    topic_name = TOPIC_MAP[topic_id]

    record = {
        "example_id": example_id,
        "grade": 6,
        "subject": "Science",
        "topic_id": topic_id,
        "topic": topic_name,
        "subtopic": subtopic.strip(),
        "example_category": example_category.strip(),
        "student_question": student_question.strip(),
        "student_context_or_attempt": student_context_or_attempt.strip(),
        "expected_answer": expected_answer.strip(),
        "teaching_response": teaching_response.strip(),
        "worked_steps": worked_steps.strip(),
        "misconception_target": misconception_target.strip(),
        "analogy_or_real_life_example": analogy_or_real_life_example.strip(),
        "diagram_or_lab_mode": diagram_or_lab_mode.strip(),
        "follow_up_question": follow_up_question.strip(),
        "expected_teaching_behaviour": expected_teaching_behaviour.strip(),
        "source_or_provenance": "Original synthetic | Pixiu Tech Class 6 Science Dataset Generator v1.0",
        "qa_status": qa_status,
        "reviewer_decision": reviewer_decision,
        "split": split
    }
    return record


VALIDATION_INDICES = {14, 15, 29, 30, 47, 48, 49, 63, 64, 78, 79, 89, 90, 99, 100}
TEST_INDICES = {11, 12, 13, 26, 27, 28, 44, 45, 46, 60, 61, 62, 75, 76, 77}

def get_default_split(index: int) -> str:
    if index in VALIDATION_INDICES:
        return "Validation"
    if index in TEST_INDICES:
        return "Test"
    return "Train"


def validate_batch(records: list[dict], expected_topic_id: str) -> tuple[bool, list[str]]:
    errors = []
    if len(records) != 100:
        errors.append(f"Expected 100 records for {expected_topic_id}, got {len(records)}")

    seen_ids = set()
    category_counts = {cat: 0 for cat in CATEGORIES}
    split_counts = {"Train": 0, "Validation": 0, "Test": 0}

    for i, rec in enumerate(records, start=1):
        expected_id = f"{expected_topic_id}-E{i:03d}"
        ex_id = rec.get("example_id")
        if ex_id != expected_id:
            errors.append(f"Row {i}: Expected example_id '{expected_id}', got '{ex_id}'")
        if ex_id in seen_ids:
            errors.append(f"Duplicate example_id: {ex_id}")
        seen_ids.add(ex_id)

        if rec.get("grade") != 6:
            errors.append(f"{ex_id}: Grade must be 6, got {rec.get('grade')}")
        if rec.get("subject") != "Science":
            errors.append(f"{ex_id}: Subject must be 'Science', got {rec.get('subject')}")
        if rec.get("topic_id") != expected_topic_id:
            errors.append(f"{ex_id}: topic_id must be '{expected_topic_id}', got '{rec.get('topic_id')}'")
        if rec.get("topic") != TOPIC_MAP.get(expected_topic_id):
            errors.append(f"{ex_id}: topic name mismatch '{rec.get('topic')}' vs '{TOPIC_MAP.get(expected_topic_id)}'")

        cat = rec.get("example_category")
        if cat in category_counts:
            category_counts[cat] += 1
        else:
            errors.append(f"{ex_id}: Invalid category '{cat}'")

        sp = rec.get("split")
        if sp in split_counts:
            split_counts[sp] += 1
        else:
            errors.append(f"{ex_id}: Invalid split '{sp}'")

        # Check required string fields are non-empty
        for field in [
            "student_question", "student_context_or_attempt", "expected_answer",
            "teaching_response", "worked_steps", "misconception_target",
            "analogy_or_real_life_example", "diagram_or_lab_mode",
            "follow_up_question", "expected_teaching_behaviour",
            "source_or_provenance", "qa_status", "reviewer_decision"
        ]:
            val = rec.get(field)
            if not val or not str(val).strip():
                errors.append(f"{ex_id}: Field '{field}' is empty or whitespace")

    # Check category distribution matches targets
    for cat, target in CATEGORY_TARGETS.items():
        if category_counts[cat] != target:
            errors.append(f"{expected_topic_id}: Category '{cat}' count is {category_counts[cat]}, expected {target}")

    # Check split distribution
    if split_counts["Train"] != 70 or split_counts["Validation"] != 15 or split_counts["Test"] != 15:
        errors.append(f"{expected_topic_id}: Split distribution mismatch: {split_counts}, expected 70/15/15")

    return (len(errors) == 0, errors)
