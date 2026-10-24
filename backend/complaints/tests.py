"""API and model tests for authentication, privacy, routing, and complaint workflow."""

from datetime import timedelta
from io import BytesIO

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from .models import (
    CATEGORY_ROUTES,
    Complaint,
    ComplaintStatusHistory,
    CompletionConfirmation,
    Department,
    Locality,
    ProgressNote,
    RepairEvidence,
    User,
)


TEST_PASSWORD = "Safe-test-password-9284!"


def make_jpeg(name="test.jpg"):
    """Return a real small JPEG so upload tests exercise content validation."""
    buffer = BytesIO()
    Image.new("RGB", (12, 12), color="green").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT="/tmp/fixmate-test-media")
class FixMateAPITests(TestCase):
    """Exercise the API with CSRF enforcement enabled as in a browser session."""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.departments = {
            code: Department.objects.create(code=code, name=name)
            for code, name in Department.Code.choices
        }
        self.locality_a = Locality.objects.create(name="Aundh")
        self.locality_b = Locality.objects.create(name="Baner")
        self.citizen = User.objects.create_user(
            email="citizen@example.test", password=TEST_PASSWORD, role=User.Role.CITIZEN
        )
        self.other_citizen = User.objects.create_user(
            email="other@example.test", password=TEST_PASSWORD, role=User.Role.CITIZEN
        )
        self.official = User.objects.create_user(
            email="official@example.test", password=TEST_PASSWORD, role=User.Role.OFFICIAL
        )
        self.official.authorized_departments.add(self.departments[Department.Code.ROAD])
        self.official.authorized_localities.add(self.locality_a)
        self.csrf_token = self.csrf()

    def csrf(self):
        response = self.client.get("/api/auth/csrf/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", self.client.cookies)
        return response.data["csrfToken"]

    def login(self, user):
        response = self.client.post(
            "/api/auth/login/",
            {"email": user.email, "password": TEST_PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(
            response.status_code,
            200,
            getattr(response, "data", response.content.decode("utf-8", errors="replace")),
        )
        self.csrf_token = response.data["csrfToken"]
        return response

    def logout(self):
        self.client.post(
            "/api/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=self.csrf_token
        )

    def create_complaint(self, citizen=None, category=Complaint.Category.ROADS, locality="Aundh", **fields):
        """Create a complaint through the same trusted routing API citizens use."""
        client = APIClient()
        client.force_authenticate(user=citizen or self.citizen)
        response = client.post(
            "/api/complaints/",
            {"category": category, "locality": locality, **fields},
            format="multipart" if "photo" in fields else "json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Complaint.objects.get(pk=response.data["id"])

    def official_login(self):
        self.login(self.official)

    def test_csrf_is_required_for_login_and_user_session_is_real(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": self.citizen.email, "password": TEST_PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.login(self.citizen)
        self.assertEqual(self.client.get("/api/auth/me/").data["role"], User.Role.CITIZEN)
        self.assertNotIn("password", self.client.get("/api/auth/me/").data)

    def test_public_registration_cannot_create_an_official_or_set_scope(self):
        payload = {
            "email": "attacker@example.test",
            "password": TEST_PASSWORD,
            "role": User.Role.OFFICIAL,
            "authorized_departments": [self.departments[Department.Code.ROAD].pk],
            "authorized_localities": [self.locality_a.pk],
        }
        response = self.client.post(
            "/api/auth/register/",
            payload,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="attacker@example.test").exists())

        response = self.client.post(
            "/api/auth/register/",
            {"email": "new-citizen@example.test", "password": TEST_PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 201, response.data)
        new_user = User.objects.get(email="new-citizen@example.test")
        self.assertEqual(new_user.role, User.Role.CITIZEN)
        self.assertTrue(new_user.check_password(TEST_PASSWORD))
        self.assertFalse(new_user.is_staff)

    def test_category_routes_are_server_selected_and_private_complaints_are_owned(self):
        for category, department_code in CATEGORY_ROUTES.items():
            complaint = self.create_complaint(category=category)
            self.assertEqual(complaint.department.code, department_code)
            self.assertEqual(complaint.status, Complaint.Status.AWAITING_REVIEW)
            history = complaint.status_history.get()
            self.assertEqual(history.new_status, Complaint.Status.AWAITING_REVIEW)
            self.assertEqual(history.actor, self.citizen)

        first = Complaint.objects.filter(reporter=self.citizen).first()
        self.create_complaint(citizen=self.other_citizen)
        self.client.force_authenticate(user=self.citizen)
        response = self.client.get("/api/complaints/mine/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 4)
        self.assertEqual(
            self.client.get(f"/api/complaints/{first.pk}/").status_code, 200
        )
        other_case = Complaint.objects.get(reporter=self.other_citizen)
        self.assertEqual(
            self.client.get(f"/api/complaints/{other_case.pk}/").status_code, 404
        )

    def test_complaint_input_rejects_client_control_of_protected_fields(self):
        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(
            "/api/complaints/",
            {
                "category": Complaint.Category.ROADS,
                "locality": "Aundh",
                "department": self.departments[Department.Code.WATER].name,
                "reporter": self.other_citizen.pk,
                "status": Complaint.Status.COMPLETED,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Complaint.objects.count(), 0)

    def test_official_scope_requires_both_department_and_locality(self):
        permitted = self.create_complaint()
        wrong_locality = self.create_complaint(locality="Baner")
        wrong_department = self.create_complaint(category=Complaint.Category.WASTE)
        # Also outside the official's locality, but reported by another citizen:
        # it must be excluded for scope reasons, never because of who filed it.
        out_of_scope = self.create_complaint(citizen=self.other_citizen, locality="Baner")
        self.official_login()

        response = self.client.get("/api/complaints/assigned/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], permitted.pk)
        self.assertEqual(self.client.get(f"/api/complaints/{permitted.pk}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/complaints/{wrong_locality.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/complaints/{wrong_department.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/complaints/{out_of_scope.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/complaints/mine/").status_code, 403)

    def test_official_can_review_and_add_notes_but_cannot_change_protected_fields(self):
        complaint = self.create_complaint()
        self.official_login()

        response = self.client.post(
            f"/api/complaints/{complaint.pk}/status/",
            {
                "status": Complaint.Status.UNRESOLVED,
                "department": self.departments[Department.Code.WATER].pk,
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(complaint.status, Complaint.Status.AWAITING_REVIEW)

        response = self.client.post(
            f"/api/complaints/{complaint.pk}/status/",
            {"status": Complaint.Status.UNRESOLVED, "note": "Reviewed by assigned official."},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 200, response.data)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, Complaint.Status.UNRESOLVED)
        history = complaint.status_history.latest("created_at")
        self.assertEqual(history.actor, self.official)
        self.assertEqual(history.previous_status, Complaint.Status.AWAITING_REVIEW)

        response = self.client.post(
            f"/api/complaints/{complaint.pk}/notes/",
            {"text": "A repair crew has been assigned."},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(ProgressNote.objects.get().author, self.official)

        self.assertEqual(
            self.client.patch(
                f"/api/complaints/{complaint.pk}/",
                {"reporter": self.other_citizen.pk},
                format="json",
                HTTP_X_CSRFTOKEN=self.csrf_token,
            ).status_code,
            405,
        )

    def test_repair_evidence_waits_for_citizen_and_history_tracks_both_actors(self):
        complaint = self.create_complaint()
        self.official_login()
        response = self.client.post(
            f"/api/complaints/{complaint.pk}/evidence/",
            {"image": make_jpeg(), "explanation": "Repair work is ready for review."},
            format="multipart",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 201, response.data)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, Complaint.Status.AWAITING_CONFIRMATION)
        self.assertEqual(RepairEvidence.objects.count(), 1)
        self.assertEqual(complaint.status_history.latest("created_at").actor, self.official)

        response = self.client.post(
            f"/api/complaints/{complaint.pk}/confirm/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(complaint.status, Complaint.Status.AWAITING_CONFIRMATION)

        self.logout()
        self.login(self.citizen)
        response = self.client.post(
            f"/api/complaints/{complaint.pk}/confirm/",
            {"comment": "I checked the repair."},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, 200, response.data)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, Complaint.Status.COMPLETED)
        confirmation = CompletionConfirmation.objects.get()
        self.assertEqual(confirmation.citizen, self.citizen)
        self.assertEqual(complaint.status_history.latest("created_at").actor, self.citizen)

    def test_wrong_citizen_cannot_confirm_or_read_another_users_history(self):
        complaint = self.create_complaint()
        complaint.status = Complaint.Status.AWAITING_CONFIRMATION
        complaint.save(update_fields=["status"])
        self.client.force_authenticate(user=self.other_citizen)
        self.assertEqual(
            self.client.post(
                f"/api/complaints/{complaint.pk}/confirm/",
                {},
                format="json",
                HTTP_X_CSRFTOKEN=self.csrf_token,
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"/api/complaints/{complaint.pk}/history/").status_code, 404
        )

    def test_upload_validation_rejects_non_images_and_large_images(self):
        self.client.force_authenticate(user=self.citizen)
        invalid = SimpleUploadedFile("fake.jpg", b"not an image", content_type="image/jpeg")
        response = self.client.post(
            "/api/complaints/",
            {
                "category": Complaint.Category.ROADS,
                "locality": "Aundh",
                "photo": invalid,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Complaint.objects.count(), 0)

        too_large = SimpleUploadedFile(
            "large.jpg", b"x" * (5 * 1024 * 1024 + 1), content_type="image/jpeg"
        )
        response = self.client.post(
            "/api/complaints/",
            {
                "category": Complaint.Category.ROADS,
                "locality": "Aundh",
                "photo": too_large,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Complaint.objects.count(), 0)

    def test_photo_downloads_are_private_and_do_not_expose_media_urls(self):
        complaint = self.create_complaint(photo=make_jpeg())
        # Anonymous callers are rejected before any file logic runs.
        self.assertEqual(
            self.client.get(f"/api/complaints/{complaint.pk}/photo/").status_code, 403
        )

        # The reporting citizen owns the photo, so sign that owner in for real.
        self.login(self.citizen)
        detail = self.client.get(f"/api/complaints/{complaint.pk}/").data
        self.assertNotIn("photo_url", detail)
        # Responses advertise only a storage name, never a direct media URL.
        self.assertFalse(str(detail["photo"] or "").startswith(("http://", "https://", "/")))
        response = self.client.get(f"/api/complaints/{complaint.pk}/photo/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")

        self.client.force_authenticate(user=self.other_citizen)
        self.assertEqual(
            self.client.get(f"/api/complaints/{complaint.pk}/photo/").status_code, 404
        )

    def test_area_report_exposes_aggregate_counts_not_complaint_details(self):
        self.create_complaint(description="Private citizen details")
        response = self.client.get("/api/area-reports/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["total"], 1)
        self.assertNotIn("Private citizen details", str(response.data))


class FixMateModelTests(TestCase):
    """Test category constraints, locality normalization, and explicit deadlines."""

    def setUp(self):
        self.citizen = User.objects.create_user(
            email="model-citizen@example.test", password=TEST_PASSWORD
        )
        self.locality = Locality.objects.create(name="Aundh")
        self.department = Department.objects.create(
            code=Department.Code.ROAD, name="Road Department"
        )

    def test_locality_names_are_normalized_and_case_insensitively_unique(self):
        self.assertEqual(Locality.objects.get().name, "Aundh")
        with self.assertRaises(IntegrityError):
            Locality.objects.create(name="  AUNDH ")

    def test_category_department_pair_is_validated_by_model(self):
        water = Department.objects.create(
            code=Department.Code.WATER, name="Water Supply Department"
        )
        complaint = Complaint(
            reporter=self.citizen,
            category=Complaint.Category.ROADS,
            department=water,
            locality=self.locality,
        )
        with self.assertRaises(ValidationError):
            complaint.full_clean()

    def test_deadline_is_never_inferred_and_overdue_requires_past_real_deadline(self):
        complaint = Complaint.objects.create(
            reporter=self.citizen,
            category=Complaint.Category.ROADS,
            department=self.department,
            locality=self.locality,
        )
        self.assertFalse(complaint.is_overdue)
        complaint.deadline_at = timezone.now() + timedelta(days=1)
        self.assertFalse(complaint.is_overdue)
        complaint.deadline_at = timezone.now() - timedelta(days=1)
        self.assertTrue(complaint.is_overdue)
        complaint.status = Complaint.Status.COMPLETED
        self.assertFalse(complaint.is_overdue)
