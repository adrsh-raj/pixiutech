from django.urls import path
from .csrf import csrf_token_view
from rest_framework.routers import DefaultRouter
from accounts.legacy_credential_routes import SchoolProfilePasswordResetView, TrainerProfilePasswordResetView
from accounts.views import ChangeOwnPasswordView, LoginView, LogoutView, MeView, RefreshView
from accounts.student_credential_views import AdminStudentCredentialExportView, AdminStudentCredentialMigrationProcessView, AdminStudentCredentialMigrationView, StudentTemporaryPasswordResetView
from academics.school_activation import activate_school
from audit.views import AuditLogViewSet
from billing.contract_views import ContractViewSet, billing_summary, billing_profile
from billing.views import InvoiceLineItemViewSet, PaymentViewSet, ReceiptViewSet
from inventory.views import KitMaintenanceViewSet
from .analytics import SchoolPerformanceView, StudentProgressView, TrainerPerformanceView
from .class_ranking import ClassRankingView
from .api_v1_compat import health
from .secure_upload import SecureUploadView
from .assessment_views_v2 import IdempotentAssessmentViewSet
from .course_completion_views_v5 import ApproveFinalProgrammeView, CompletionPolicyView, CourseCompletionDetailView, CourseCompletionListView, CourseCompletionScopeView, EvaluateLastSessionView, IssueProgrammeCertificateView, TechnologyListCreateView, VerifyProgrammeCertificateView
from .certificate_pdf_views_v2 import CertificatePdfViewV2, PublicCertificatePdfViewV2, ScorecardPdfViewV2
from .cohort_evaluation_views import ClassEvaluationView, StudentProgressReportDataView
from .course_completion_session_v4 import ProgrammeAwareSessionViewSet
from .course_completion_compat import cohort_rank
from .public_enquiry import PublicEnquiryView
from crm.career_views import CareerApplicationViewSet, CareerOpeningViewSet, PublicCareerApplicationView, PublicCareerOpeningsView
from .phase7_compat_extras import ContractCommunicationLogViewSet
from .billing_contract_overrides import TransactionalInvoiceViewSet
from .inventory_contract_overrides import JsonKitComponentViewSet, JsonKitViewSet
from .scoped_contract_views import ScopedContractBillingFullViewSet, ScopedContractInventoryViewSet, ScopedContractLeadViewSet, ScopedContractReviewViewSet
from .student_portal_views import StudentPortalViewSet
from .trainer_materials import TrainerMaterialDetailView, TrainerMaterialFileView, TrainerMaterialListCreateView
from .learning_content_files import LearningContentFileView, LearningContentPlaybackTokenView, LearningContentVideoView
from .quiz_documents import QuizResultPdfView, QuizResultView
from learning.trainer_units import TrainerUnitListCreateView
from notifications.views import NotificationPortalViewSet
from learning.quiz_portal import QuizSingleAttemptView, QuizStartView, QuizReviewView
from .scoped_curriculum import ScopedCurriculumViewSet
from .strict_learning_scope_views import SafeScopedAttendanceViewSet, SafeScopedClassViewSet, SafeScopedContentViewSet, SafeScopedEvidenceViewSet, SafeScopedProjectViewSet, SafeScopedQuizAssignmentViewSet, SafeScopedQuizAttemptViewSet, SafeScopedQuizQuestionViewSet, SafeScopedQuizViewSet, SafeScopedSessionActivityViewSet, SafeScopedTrainerSchoolAssignmentViewSet, SafeScopedSchoolViewSet, SafeScopedTrainerViewSet

router = DefaultRouter(trailing_slash=False)
router.register('schools', SafeScopedSchoolViewSet, basename='v1-school')
router.register('trainers', SafeScopedTrainerViewSet, basename='v1-trainer')
router.register('trainer-school-assignments', SafeScopedTrainerSchoolAssignmentViewSet, basename='v1-trainer-school-assignment')
router.register('classes', SafeScopedClassViewSet, basename='v1-class')
router.register('students', StudentPortalViewSet, basename='v1-student')
router.register('sessions', ProgrammeAwareSessionViewSet, basename='v1-session')
router.register('session-activities', SafeScopedSessionActivityViewSet, basename='v1-session-activity')
router.register('attendance', SafeScopedAttendanceViewSet, basename='v1-attendance')
router.register('curriculum', ScopedCurriculumViewSet, basename='v1-curriculum')
router.register('content', SafeScopedContentViewSet, basename='v1-content')
router.register('quizzes', SafeScopedQuizViewSet, basename='v1-quiz')
router.register('quiz-questions', SafeScopedQuizQuestionViewSet, basename='v1-quiz-question')
router.register('quiz-assignments', SafeScopedQuizAssignmentViewSet, basename='v1-quiz-assignment')
router.register('quiz-submissions', SafeScopedQuizAttemptViewSet, basename='v1-quiz-submission')
router.register('reviews', ScopedContractReviewViewSet, basename='v1-review')
router.register('assessments', IdempotentAssessmentViewSet, basename='v1-assessment')
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
router.register('careers/openings', CareerOpeningViewSet, basename='v1-career-opening')
router.register('careers/applications', CareerApplicationViewSet, basename='v1-career-application')
router.register('logs', AuditLogViewSet, basename='v1-audit-log')

urlpatterns = [
    path('health/', health, name='v1-health'), path('upload/', SecureUploadView.as_view(), name='v1-upload'),
    path('auth/csrf/', csrf_token_view, name='v1-csrf-token'), path('auth/login/', LoginView.as_view(), name='v1-login'), path('auth/refresh/', RefreshView.as_view(), name='v1-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='v1-logout'), path('auth/me/', MeView.as_view(), name='v1-me'), path('auth/password/change/', ChangeOwnPasswordView.as_view(), name='v1-password-change'),
    path('students/credentials/migrate', AdminStudentCredentialMigrationView.as_view(), name='v1-student-credential-migrate'),
    path('students/credentials/migrate/<uuid:batch_id>/process', AdminStudentCredentialMigrationProcessView.as_view(), name='v1-student-credential-migrate-process'),
    path('students/credentials/migrate/<uuid:batch_id>/<str:export_format>', AdminStudentCredentialExportView.as_view(), name='v1-student-credential-export'),
    path('students/<uuid:pk>/reset-password', StudentTemporaryPasswordResetView.as_view(), name='v1-student-reset-password'),
    path('certificates/issue/<uuid:student_key>', IssueProgrammeCertificateView.as_view(), name='v1-certificate-issue'),
    path('certificates/pdf/<str:student_key>', CertificatePdfViewV2.as_view(), name='v1-certificate-pdf'),
    path('certificates/scorecard/<str:student_key>', ScorecardPdfViewV2.as_view(), name='v1-certificate-scorecard-pdf'),
    path('public/certificates/pdf/<str:certificate_id>', PublicCertificatePdfViewV2.as_view(), name='v1-public-certificate-pdf'),
    path('public/certificates/verify/<str:student_id>', VerifyProgrammeCertificateView.as_view(), name='v1-certificate-verify-legacy'),
    path('public/certificates/verify', VerifyProgrammeCertificateView.as_view(), name='v1-certificate-verify'),
    path('technologies', TechnologyListCreateView.as_view(), name='v1-technologies'),
    path('course-completion/scope', CourseCompletionScopeView.as_view(), name='v1-course-completion-scope'),
    path('course-completion', CourseCompletionListView.as_view(), name='v1-course-completion-list'),
    path('course-completion/<str:student_key>', CourseCompletionDetailView.as_view(), name='v1-course-completion-detail'),
    path('course-completion/policy/<uuid:class_key>', CompletionPolicyView.as_view(), name='v1-course-completion-policy'),
    path('course-completion/class/<uuid:class_key>/evaluation', ClassEvaluationView.as_view(), name='v1-course-completion-class-evaluation'),
    path('course-completion/student-report/<str:student_key>', StudentProgressReportDataView.as_view(), name='v1-course-completion-student-report'),
    path('course-completion/session/<uuid:session_id>/evaluate', EvaluateLastSessionView.as_view(), name='v1-course-completion-session-evaluate'),
    path('course-completion/<str:student_key>/request', ApproveFinalProgrammeView.as_view(), name='v1-course-completion-request'),
    path('course-completion/<str:student_key>/complete', ApproveFinalProgrammeView.as_view(), name='v1-course-completion-complete'),
    path('course-completion/<str:student_key>/certificate', IssueProgrammeCertificateView.as_view(), name='v1-course-completion-certificate'),
    path('public/enquiries', PublicEnquiryView.as_view(), name='v1-public-enquiry'),
    path('public/careers/openings', PublicCareerOpeningsView.as_view(), name='v1-public-career-openings'),
    path('public/careers/apply', PublicCareerApplicationView.as_view(), name='v1-public-career-apply'),
    path('schools/<uuid:pk>/reset-password', SchoolProfilePasswordResetView.as_view(), name='v1-school-password-reset'), path('schools/<uuid:pk>/activate', activate_school, name='v1-school-activate'),
    path('trainers/<uuid:pk>/reset-password', TrainerProfilePasswordResetView.as_view(), name='v1-trainer-password-reset'),
    path('trainer-materials', TrainerMaterialListCreateView.as_view(), name='v1-trainer-material-list-create'), path('trainer-materials/<uuid:pk>', TrainerMaterialDetailView.as_view(), name='v1-trainer-material-detail'), path('trainer-materials/<uuid:pk>/file', TrainerMaterialFileView.as_view(), name='v1-trainer-material-file'),
    path('content/<uuid:pk>/file', LearningContentFileView.as_view(), name='v1-learning-content-file'),
    path('content/<uuid:pk>/playback', LearningContentPlaybackTokenView.as_view(), name='v1-learning-content-playback'),
    path('content/<uuid:pk>/video', LearningContentVideoView.as_view(), name='v1-learning-content-video'), path('billing-summary', billing_summary, name='v1-billing-summary'), path('billing-profile', billing_profile, name='v1-billing-profile'),
    path('class-ranking', ClassRankingView.as_view(), name='v1-class-ranking'), path('student-progress', StudentProgressView.as_view(), name='v1-student-progress'), path('trainer-performance', TrainerPerformanceView.as_view(), name='v1-trainer-performance'), path('school-performance', SchoolPerformanceView.as_view(), name='v1-school-performance'),
    path('quizzes/<uuid:pk>/start', QuizStartView.as_view(), name='v1-quiz-start'), path('quizzes/<uuid:pk>/single-attempt', QuizSingleAttemptView.as_view(), name='v1-quiz-single-attempt'),
    path('quiz-review', QuizReviewView.as_view(), name='v1-quiz-review'), path('quiz-results/<uuid:pk>', QuizResultView.as_view(), name='v1-quiz-result'), path('quiz-results/<uuid:pk>/pdf', QuizResultPdfView.as_view(), name='v1-quiz-result-pdf'),
    path('trainer-units', TrainerUnitListCreateView.as_view(), name='v1-trainer-units'),
] + router.urls