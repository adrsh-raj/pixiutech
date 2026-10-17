"""
Topic 13: Fun with Magnets (G6-SCI-013)
NCERT Class 6 Science Chapter 13 (Rationalised Ch 10 / Curiosity Ch 4)
Dataset generator: exactly 100 comprehensive records.
"""

from common import make_record, get_default_split, validate_batch
import data_t13_part1 as p1
import data_t13_part2 as p2


def generate_topic_13():
    topic_id = "G6-SCI-013"
    records = []

    # 1..15: Concept understanding (15)
    concept_data = p1.concept_data
    assert len(concept_data) == 15
    for i, item in enumerate(concept_data, 1):
        subtopic, sq, sc, ea, tr, ws, mt, ar, dm, fq, tb = item
        records.append(make_record(
            topic_id=topic_id, index=i, subtopic=subtopic,
            example_category="Concept understanding",
            student_question=sq, student_context_or_attempt=sc,
            expected_answer=ea, teaching_response=tr, worked_steps=ws,
            misconception_target=mt, analogy_or_real_life_example=ar,
            diagram_or_lab_mode=dm, follow_up_question=fq,
            expected_teaching_behaviour=tb, split=get_default_split(i)
        ))

    # 16..30: Real-life applications (15)
    real_life_data = p1.real_life_data
    assert len(real_life_data) == 15
    for i, item in enumerate(real_life_data, 16):
        subtopic, sq, sc, ea, tr, ws, mt, ar, dm, fq, tb = item
        records.append(make_record(
            topic_id=topic_id, index=i, subtopic=subtopic,
            example_category="Real-life application",
            student_question=sq, student_context_or_attempt=sc,
            expected_answer=ea, teaching_response=tr, worked_steps=ws,
            misconception_target=mt, analogy_or_real_life_example=ar,
            diagram_or_lab_mode=dm, follow_up_question=fq,
            expected_teaching_behaviour=tb, split=get_default_split(i)
        ))

    # 31..50: Misconceptions and corrective teaching (20)
    misc_data = p1.misc_data
    assert len(misc_data) == 20
    for i, item in enumerate(misc_data, 31):
        subtopic, sq, sc, ea, tr, ws, mt, ar, dm, fq, tb = item
        records.append(make_record(
            topic_id=topic_id, index=i, subtopic=subtopic,
            example_category="Misconceptions and corrective teaching",
            student_question=sq, student_context_or_attempt=sc,
            expected_answer=ea, teaching_response=tr, worked_steps=ws,
            misconception_target=mt, analogy_or_real_life_example=ar,
            diagram_or_lab_mode=dm, follow_up_question=fq,
            expected_teaching_behaviour=tb, split=get_default_split(i)
        ))

    # 51..65: Step-by-step reasoning / problem solving (15)
    reasoning_data = p2.reasoning_data
    assert len(reasoning_data) == 15
    for i, item in enumerate(reasoning_data, 51):
        subtopic, sq, sc, ea, tr, ws, mt, ar, dm, fq, tb = item
        records.append(make_record(
            topic_id=topic_id, index=i, subtopic=subtopic,
            example_category="Step-by-step reasoning / problem solving",
            student_question=sq, student_context_or_attempt=sc,
            expected_answer=ea, teaching_response=tr, worked_steps=ws,
            misconception_target=mt, analogy_or_real_life_example=ar,
            diagram_or_lab_mode=dm, follow_up_question=fq,
            expected_teaching_behaviour=tb, split=get_default_split(i)
        ))

    # 66..80: Diagram, graph, or virtual-lab reasoning (15)
    lab_data = p2.lab_data
    assert len(lab_data) == 15
    for i, item in enumerate(lab_data, 66):
        subtopic, sq, sc, ea, tr, ws, mt, ar, dm, fq, tb = item
        records.append(make_record(
            topic_id=topic_id, index=i, subtopic=subtopic,
            example_category="Diagram, graph, or virtual-lab reasoning",
            student_question=sq, student_context_or_attempt=sc,
            expected_answer=ea, teaching_response=tr, worked_steps=ws,
            misconception_target=mt, analogy_or_real_life_example=ar,
            diagram_or_lab_mode=dm, follow_up_question=fq,
            expected_teaching_behaviour=tb, split=get_default_split(i)
        ))

    # 81..90: Follow-up / understanding checks (10)
    follow_up_data = p2.follow_up_data
    assert len(follow_up_data) == 10
    for i, item in enumerate(follow_up_data, 81):
        subtopic, sq, sc, ea, tr, ws, mt, ar, dm, fq, tb = item
        records.append(make_record(
            topic_id=topic_id, index=i, subtopic=subtopic,
            example_category="Follow-up / understanding checks",
            student_question=sq, student_context_or_attempt=sc,
            expected_answer=ea, teaching_response=tr, worked_steps=ws,
            misconception_target=mt, analogy_or_real_life_example=ar,
            diagram_or_lab_mode=dm, follow_up_question=fq,
            expected_teaching_behaviour=tb, split=get_default_split(i)
        ))

    # 91..100: Challenge / edge cases (10)
    challenge_data = p2.challenge_data
    assert len(challenge_data) == 10
    for i, item in enumerate(challenge_data, 91):
        subtopic, sq, sc, ea, tr, ws, mt, ar, dm, fq, tb = item
        records.append(make_record(
            topic_id=topic_id, index=i, subtopic=subtopic,
            example_category="Challenge / edge cases",
            student_question=sq, student_context_or_attempt=sc,
            expected_answer=ea, teaching_response=tr, worked_steps=ws,
            misconception_target=mt, analogy_or_real_life_example=ar,
            diagram_or_lab_mode=dm, follow_up_question=fq,
            expected_teaching_behaviour=tb, split=get_default_split(i)
        ))

    validate_batch(records, topic_id)
    return records


if __name__ == "__main__":
    records = generate_topic_13()
    print(f"Generated {len(records)} records for Topic 13.")
    print("Sample record 1:", records[0]["example_id"], records[0]["student_question"][:60])
    print("Sample record 100:", records[-1]["example_id"], records[-1]["student_question"][:60])
