from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.services import accessible_class_queryset
from learning.models import QuizAttempt

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer


LOGO_PATH = Path(__file__).resolve().parent / "assets" / "pixiu-logo.png"


def _get_attempt(pk, user):
    attempt = QuizAttempt.objects.select_related(
        "quiz", "student", "student__school_class", "student__school_class__school"
    ).prefetch_related("quiz__questions").filter(pk=pk).first()
    if attempt is None:
        raise ValidationError("Quiz attempt was not found.")
    if user.role == UserRole.STUDENT:
        if attempt.student.account_id != user.id:
            raise PermissionDenied("You can only view your own quiz result.")
    elif user.role == UserRole.ADMIN:
        pass
    elif user.role in {UserRole.SCHOOL, UserRole.TRAINER}:
        if not accessible_class_queryset(user).filter(pk=attempt.student.school_class_id).exists():
            raise PermissionDenied("You are not authorised to view this quiz result.")
    else:
        raise PermissionDenied("Quiz result access is not available for this role.")
    return attempt


def _clean_answers(attempt):
    answers = {str(key): value for key, value in (attempt.answers or {}).items() if str(key) != "__pixiu_exam_started_at"}
    return {str(key): str(value).strip().upper() for key, value in answers.items() if str(value).strip()}


def _result_payload(attempt):
    answers = _clean_answers(attempt)
    questions = sorted(attempt.quiz.questions.all(), key=lambda item: item.question_order)
    rows = []
    for question in questions:
        selected = answers.get(str(question.id))
        rows.append({
            "question_id": str(question.id),
            "question": question.question_text,
            "options": {"A": question.option_a, "B": question.option_b, "C": question.option_c, "D": question.option_d},
            "selected": selected,
            "correct": question.correct_option,
            "is_correct": bool(selected and selected == question.correct_option),
            "explanation": question.explanation,
            "points": float(question.points),
        })
    return {
        "id": str(attempt.id), "quiz": str(attempt.quiz_id), "quiz_title": attempt.quiz.title,
        "student": str(attempt.student_id), "student_name": attempt.student.name, "student_id": attempt.student.student_id,
        "score": float(attempt.score), "total_marks": float(attempt.total_marks), "percentage": float(attempt.percentage),
        "correct_answers": attempt.correct_count, "wrong_answers": max(attempt.total_questions - attempt.correct_count, 0),
        "attempted_count": attempt.attempted_count, "total_questions": attempt.total_questions,
        "attempt_number": attempt.attempt_number, "submitted_at": attempt.completed_at,
        "time_taken_seconds": attempt.time_taken_seconds, "violation_count": attempt.violation_count,
        "status": attempt.status, "answers": rows,
    }


def _page(canvas, doc):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#0f172a")); canvas.rect(0, height - 17 * mm, width, 17 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#2563eb")); canvas.rect(0, 0, width, 5 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#64748b")); canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - 15 * mm, 8 * mm, f"Pixiu Tech • Page {doc.page}"); canvas.restoreState()


def _header_elements(title, attempt):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("result-title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#0f172a"), alignment=TA_LEFT, spaceAfter=2 * mm)
    meta_style = ParagraphStyle("result-meta", parent=styles["BodyText"], fontSize=9.5, leading=13, textColor=colors.HexColor("#475569"))
    flow = []
    if LOGO_PATH.exists(): flow.extend([Image(str(LOGO_PATH), width=18 * mm, height=18 * mm), Spacer(1, 2 * mm)])
    flow.append(Paragraph("PIXIU TECH", ParagraphStyle("brand", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#2563eb"))))
    flow.append(Paragraph(title, title_style))
    flow.append(Paragraph(f"<b>Student:</b> {escape(str(attempt.student.name))} &nbsp;&nbsp; <b>Student ID:</b> {escape(str(attempt.student.student_id))}", meta_style))
    flow.append(Paragraph(f"<b>Quiz:</b> {escape(str(attempt.quiz.title))} &nbsp;&nbsp; <b>Attempt:</b> {attempt.attempt_number} &nbsp;&nbsp; <b>Score:</b> {attempt.score:g} / {attempt.total_marks:g} ({attempt.percentage:g}%)", meta_style))
    flow.append(Paragraph(f"<b>Submitted:</b> {attempt.completed_at or '—'} &nbsp;&nbsp; <b>Time:</b> {attempt.time_taken_seconds or 0}s", meta_style))
    flow.extend([Spacer(1, 3 * mm), HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#dbe4ee"), spaceAfter=2 * mm)])
    return flow


def _answer_text(question, key):
    return f"{key}. {getattr(question, f'option_{key.lower()}')}"


def _build_pdf(attempt, kind):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15 * mm, leftMargin=15 * mm, topMargin=24 * mm, bottomMargin=12 * mm)
    flow = _header_elements("My Answers Report" if kind == "answers" else "Official Answer Key", attempt)
    styles = getSampleStyleSheet()
    question_style = ParagraphStyle("result-question", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=colors.HexColor("#0f172a"), spaceAfter=1.5 * mm)
    option_style = ParagraphStyle("result-option", parent=styles["BodyText"], fontSize=9.5, leading=13, textColor=colors.HexColor("#334155"), leftIndent=3 * mm, spaceAfter=1 * mm)
    small_style = ParagraphStyle("result-small", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=colors.HexColor("#64748b"))
    questions = sorted(attempt.quiz.questions.all(), key=lambda item: item.question_order); answers = _clean_answers(attempt)
    for index, question in enumerate(questions, start=1):
        selected = answers.get(str(question.id)); flow.append(Paragraph(f"{index}. {escape(str(question.question_text))}", question_style))
        if kind == "answers":
            chosen = selected or "Not answered"; chosen_text = _answer_text(question, chosen) if selected else chosen
            marker = "Correct" if selected and selected == question.correct_option else "Incorrect / unanswered"
            flow.append(Paragraph(f"<b>Your answer:</b> {escape(chosen_text)} &nbsp;&nbsp; <b>{marker}</b>", option_style))
        else:
            flow.append(Paragraph(f"<b>Correct answer:</b> {escape(_answer_text(question, question.correct_option))}", option_style))
            if question.explanation: flow.append(Paragraph(f"<b>Explanation:</b> {escape(str(question.explanation))}", small_style))
        if index < len(questions): flow.extend([Spacer(1, 1.5 * mm), HRFlowable(width="100%", thickness=0.4, color=colors.HexColor("#e2e8f0"), spaceAfter=2 * mm)])
    doc.build(flow, onFirstPage=_page, onLaterPages=_page); return buffer.getvalue()


class QuizResultView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk): return Response(_result_payload(_get_attempt(pk, request.user)))


class QuizResultPdfView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk):
        attempt = _get_attempt(pk, request.user); kind = str(request.query_params.get("kind") or "answers").strip().lower()
        if kind not in {"answers", "key"}: raise ValidationError({"kind": "Use answers or key."})
        content = _build_pdf(attempt, kind); slug = "my-answers" if kind == "answers" else "answer-key"
        response = HttpResponse(content, content_type="application/pdf"); response["Content-Disposition"] = f'attachment; filename="pixiu-{slug}-{attempt.student.student_id}-{attempt.quiz.id}.pdf"'; return response
