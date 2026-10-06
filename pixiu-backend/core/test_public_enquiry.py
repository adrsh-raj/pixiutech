import tempfile
from io import BytesIO

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import User, UserRole, UserStatus
from crm.models import LabEnquiryAttachment, Lead, LeadEnquiryType
from core.public_enquiry import LabEnquiryAttachmentView, PublicEnquiryView
from crm.serializers import LeadSerializer


def valid_png():
    stream = BytesIO()
    Image.new("RGB", (8, 8), (40, 120, 220)).save(stream, format="PNG")
    return stream.getvalue()


class PublicLabEnquiryTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create_user(
            "lab-admin",
            password="test-password",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        self.trainer = User.objects.create_user(
            "lab-trainer",
            password="test-password",
            role=UserRole.TRAINER,
            status=UserStatus.ACTIVE,
            is_active=True,
        )

    def lab_request(self, *, enquiry_type="philosophy", user=None, with_image=True):
        data = {
            "enquiry_type": enquiry_type,
            "student_id": "PX-STUDENT-001",
            "message": "The Lab should let me rethink this circuit.",
            "website": "",
        }
        if with_image:
            data["image"] = SimpleUploadedFile(
                "circuit-screen.png",
                valid_png(),
                content_type="image/png",
            )
        request = self.factory.post("/api/v1/public/enquiries", data, format="multipart")
        if user is not None:
            force_authenticate(request, user=user)
        return request

    def test_lab_support_requires_authentication(self):
        response = PublicEnquiryView.as_view()(self.lab_request(user=None))
        self.assertEqual(response.status_code, 401)
        self.assertEqual(Lead.objects.count(), 0)

    def test_think_rethink_enquiry_is_captured_with_private_attachment(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, CLAMAV_ENABLED=False, CLAMAV_REQUIRED=False):
                response = PublicEnquiryView.as_view()(self.lab_request(user=self.admin))

                self.assertEqual(response.status_code, 201)
                lead = Lead.objects.get()
                self.assertEqual(lead.enquiry_type, LeadEnquiryType.PHILOSOPHY)
                self.assertEqual(lead.organization_name, "PIXIU Virtual Lab")
                self.assertIn("Think / Rethink Philosophy", lead.notes)

                attachment = LabEnquiryAttachment.objects.get(lead=lead)
                self.assertTrue(attachment.file.name.startswith("private_lab_enquiries/"))
                self.assertNotIn("circuit-screen.png", attachment.file.name)

                serializer = LeadSerializer(
                    lead,
                    context={"request": response.wsgi_request},
                )
                attachment_url = serializer.data["lab_attachments"][0]["url"]
                self.assertIn(f"/api/v1/lab-enquiry-attachments/{attachment.id}", attachment_url)

    def test_lab_attachment_is_admin_only(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, CLAMAV_ENABLED=False, CLAMAV_REQUIRED=False):
                response = PublicEnquiryView.as_view()(self.lab_request(user=self.admin))
                self.assertEqual(response.status_code, 201)
                attachment = LabEnquiryAttachment.objects.get()

                admin_request = self.factory.get(f"/api/v1/lab-enquiry-attachments/{attachment.id}")
                force_authenticate(admin_request, user=self.admin)
                admin_response = LabEnquiryAttachmentView.as_view()(admin_request, attachment_id=attachment.id)
                self.assertEqual(admin_response.status_code, 200)
                self.assertEqual(admin_response["Content-Type"], "image/png")
                self.assertTrue(admin_response["Content-Disposition"].startswith("inline;"))

                trainer_request = self.factory.get(f"/api/v1/lab-enquiry-attachments/{attachment.id}")
                force_authenticate(trainer_request, user=self.trainer)
                trainer_response = LabEnquiryAttachmentView.as_view()(trainer_request, attachment_id=attachment.id)
                self.assertEqual(trainer_response.status_code, 403)
