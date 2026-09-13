from django.urls import path
from rest_framework.routers import DefaultRouter
from accounts.legacy_credential_routes import SchoolProfilePasswordResetView, TrainerProfilePasswordResetView
from accounts.views import LoginView, LogoutView, MeView, RefreshView
from academics.school_activation import activate_school
from audit.views import AuditLogViewSet
from billing.contract_views import ContractViewSet, billing_summary
from billing.views import InvoiceLineItemViewSet, PaymentViewSet, ReceiptViewSet
from inventory.views import KitMaintenanceViewSet
from .analytics import SchoolPerformanceView, StudentProgressView, TrainerPerformanceView
from .class_ranking import ClassRankingView
from .api_v1_compat import health, upload
from .course_completion_views_v3 import AdminCompleteProgrammeView, CompletionPolicyView, CourseCompletionDetailView, CourseCompletionListView, EvaluateLastSessionView, IssueProgrammeCertificateView, RequestProgrammeCompletionView, TechnologyListCreateView, VerifyProgrammeCertificateView
from .course_completion_session_v3 import CourseAwareSessionViewSet
from .course_completion_compat import cohort_rank
from .public_enquiry import PublicEnquiryView
from .phase7_compat_extras import ContractCommunicationLogViewSet
from .billing_contract_overrides import TransactionalInvoiceViewSet
from .inventory_contract_overrides import JsonKitComponentViewSet, JsonKitViewSet
from .scoped_contract_views import ScopedContractBillingFullViewSet, ScopedContractInventoryViewSet, ScopedContractLeadViewSet, ScopedContractReviewViewSet, ScopedContractSchoolViewSet, ScopedContractTrainerViewSet
from .trainer_materials import TrainerMaterialDetailView, TrainerMaterialFileView, TrainerMaterialListCreateView
from .learning_content_files import LearningContentFileView
from .quiz_documents import QuizResultPdfView, QuizResultView
from learning.trainer_units import TrainerUnitListCreateView
from notifications.views import NotificationPortalViewSet
from learning.quiz_portal import QuizSingleAttemptView, QuizStartView, QuizReviewView
from .strict_learning_scope_views import SafeScopedAssessmentViewSet, SafeScopedAttendanceViewSet, SafeScopedClassViewSet, SafeScopedContentViewSet, SafeScopedCurriculumViewSet, SafeScopedEvidenceViewSet, SafeScopedProjectViewSet, SafeScopedQuizAssignmentViewSet, SafeScopedQuizAttemptViewSet, SafeScopedQuizQuestionViewSet, SafeScopedQuizViewSet, SafeScopedSessionActivityViewSet, SafeScopedStudentViewSet, SafeScopedTrainerSchoolAssignmentViewSet, SafeScopedSchoolViewSet, SafeScopedTrainerViewSet

router = DefaultRouter(trailing_slash=False)
router.register('schools', SafeScopedSchoolViewSet, basename='v1-school')
router.register('trainers', SafeScopedTrainerViewSet, basename='v1-trainer')
router.register('trainer-school-assignments', SafeScopedTrainerSchoolAssignmentViewSet, basename='v1-trainer-school-assignment')
router.register('classes', SafeScopedClassViewSet, basename='v1-class')
router.register('students', SafeScopedStudentViewSet, basename='v1-student')
router.register('sessions', CourseAwareSessionViewSet, basename='v1-session')
router.register('session-activities', SafeScopedSessionActivityViewSet, basename='v1-session-activity')
router.register('attendance', SafeScopedAttendanceViewSet, basename='v1-attendance')
router.register('curriculum', SafeScopedCurriculumViewSet, basename='v1-curriculum')
router.register('content', SafeScopedContentViewSet, basename='v1-content')
router.register('quizzes', SafeScopedQuizViewSet, basename='v1-quiz')
router.register('quiz-questions', SafeScopedQuizQuestionViewSet, basename='v1-quiz-question')
router.register('quiz-assignments', SafeScopedQuizAssignmentViewSet, basename='v1-quiz-assignment')
router.register('quiz-submissions', SafeScopedQuizAttemptViewSet, basename='v1-quiz-submission')
router.register('reviews', ScopedContractReviewViewSet, basename='v1-review')
router.register('assessments', SafeScopedAssessmentViewSet, basename='v1-assessment')
router.register('projects', SafeScopedProjectViewSet, basename='v1-project')
router.register('project-evidence', SafeScopedEvidenceViewSet, basename='v1-project-evidence')
router.register('billing', ScopedContractBillingFullViewSet, basename='v1-billing-compat')
router.register('invoices', TransactionalInvoiceViewSet, basename='v1-invoice')
router.register('contracts', ContractViewSet, basename='v1-contract')
router.register('billing-lines', InvoiceLineItemViewSet, basename='v1-billing-line')
router.register('payments', PaymentViewSet, basename='v1-payment')
router.register('receipts', ReceiptViewSet, basename='v1-receipt')
router.register('kits', JsonKitViewSet, basename='v1-kit')
router.register('kit-components', JsonKitComponentViewSet, basename='v1-kit-component')
router.register('kit-maintenance', KitMaintenanceViewSet, basename='v1-kit-maintenance')
router.register('inventory', ScopedContractInventoryViewSet, basename='v1-inventory')
router.register('leads', ScopedContractLeadViewSet, basename='v1-lead')
router.register('notifications', NotificationPortalViewSet, basename='v1-notification')
router.register('comms', ContractCommunicationLogViewSet, basename='v1-comms')
router.register('logs', AuditLogViewSet, basename='v1-audit-log')

urlpatterns = [
    path('health/', health, name='v1-health'), path('upload/', upload, name='v1-upload'),
    path('auth/login/', LoginView.as_view(), name='v1-login'), path('auth/refresh/', RefreshView.as_view(), name='v1-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='v1-logout'), path('auth/me/', MeView.as_view(), name='v1-me'),
    path('certificates/issue/<uuid:student_key>', IssueProgrammeCertificateView.as_view(), name='v1-certificate-issue'),
    path('public/certificates/verify/<str:student_id>', VerifyProgrammeCertificateView.as_view(), name='v1-certificate-verify-legacy'),
    path('public/certificates/verify', VerifyProgrammeCertificateView.as_view(), name='v1-certificate-verify'),
    path('technologies', TechnologyListCreateView.as_view(), name='v1-technologies'),
    path('course-completion', CourseCompletionListView.as_view(), name='v1-course-completion-list'),
    path('course-completion/<str:student_key>', CourseCompletionDetailView.as_view(), name='v1-course-completion-detail'),
    path('course-completion/policy/<uuid:class_key>', CompletionPolicyView.as_view(), name='v1-course-completion-policy'),
    path('course-completion/session/<uuid:session_id>/evaluate', EvaluateLastSessionView.as_view(), name='v1-course-completion-session-evaluate'),
    path('course-completion/<str:student_key>/request', RequestProgrammeCompletionView.as_view(), name='v1-course-completion-request'),
    path('course-completion/<str:student_key>/complete', AdminCompleteProgrammeView.as_view(), name='v1-course-completion-complete'),
    path('course-completion/<str:student_key>/certificate', IssueProgrammeCertificateView.as_view(), name='v1-course-completion-certificate'),
    path('public/enquiries', PublicEnquiryView.as_view(), name='v1-public-enquiry'),
    path('schools/<uuid:pk>/reset-password', SchoolProfilePasswordResetView.as_view(), name='v1-school-password-reset'), path('schools/<uuid:pk>/activate', activate_school, name='v1-school-activate'),
    path('trainers/<uuid:pk>/reset-password', TrainerProfilePasswordResetView.as_view(), name='v1-trainer-password-reset'),
    path('trainer-materials', TrainerMaterialListCreateView.as_view(), name='v1-trainer-material-list-create'), path('trainer-materials/<uuid:pk>', TrainerMaterialDetailView.as_view(), name='v1-trainer-material-detail'), path('trainer-materials/<uuid:pk>/file', TrainerMaterialFileView.as_view(), name='v1-trainer-material-file'),
    path('content/<uuid:pk>/file', LearningContentFileView.as_view(), name='v1-learning-content-file'), path('billing-summary', billing_summary, name='v1-billing-summary'),
    path('class-ranking', ClassRankingView.as_view(), name='v1-class-ranking'), path('student-progress', StudentProgressView.as_view(), name='v1-student-progress'), path('trainer-performance', TrainerPerformanceView.as_view(), name='v1-trainer-performance'), path('school-performance', SchoolPerformanceView.as_view(), name='v1-school-performance'),
    path('quizzes/<uuid:pk>/start', QuizStartView.as_view(), name='v1-quiz-start'), path('quizzes/<uuid:pk>/single-attempt', QuizSingleAttemptView.as_view(), name='v1-quiz-single-attempt'),
    path('quiz-review', QuizReviewView.as_view(), name='v1-quiz-review'), path('quiz-results/<uuid:pk>', QuizResultView.as_view(), name='v1-quiz-result'), path('quiz-results/<uuid:pk>/pdf', QuizResultPdfView.as_view(), name='v1-quiz-result-pdf'),
    path('trainer-units', TrainerUnitListCreateView.as_view(), name='v1-trainer-units'),
] + router.urls
