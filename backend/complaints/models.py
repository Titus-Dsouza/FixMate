"""Database models for FixMate users and complaint workflows."""

import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models

from .validators import validate_image_upload


class Department(models.Model):
    """A trusted department used for server-side complaint routing."""

    class Code(models.TextChoices):
        ROAD = "road", "Road Department"
        WASTE = "waste", "Solid Waste Management"
        DRAINAGE = "drainage", "Drainage Department"
        WATER = "water", "Water Supply Department"

    code = models.CharField(max_length=20, choices=Code.choices, unique=True)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Locality(models.Model):
    """A normalized Pune-area name that officials can be authorized to serve."""

    name = models.CharField(max_length=100)
    normalized_name = models.CharField(max_length=100, unique=True, editable=False)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        self.name = " ".join(self.name.split())
        self.normalized_name = self.name.casefold()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class FixMateUserManager(BaseUserManager):
    """Create accounts using email as the sole login identifier."""

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("A superuser must have staff and superuser permissions.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """An email-login account with citizen or administrator-provisioned official role."""

    class Role(models.TextChoices):
        CITIZEN = "citizen", "Citizen"
        OFFICIAL = "official", "Government official"

    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.CITIZEN)
    authorized_departments = models.ManyToManyField(
        Department, blank=True, related_name="authorized_users"
    )
    authorized_localities = models.ManyToManyField(
        Locality, blank=True, related_name="authorized_users"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = FixMateUserManager()

    def clean(self):
        super().clean()
        if self.role == self.Role.CITIZEN and self.pk:
            if self.authorized_departments.exists() or self.authorized_localities.exists():
                raise ValidationError("Citizen accounts cannot have official assignments.")

    def __str__(self):
        return self.email


CATEGORY_ROUTES = {
    "Roads & Footpaths": Department.Code.ROAD,
    "Garbage & Waste": Department.Code.WASTE,
    "Drainage & Waterlogging": Department.Code.DRAINAGE,
    "Water Supply & Leakage": Department.Code.WATER,
}


def complaint_photo_path(instance, filename):
    """Store complaint photos under an opaque name rather than a user filename."""
    extension = filename.rsplit(".", 1)[-1].lower()
    return f"complaints/{uuid.uuid4().hex}.{extension}"


def evidence_photo_path(instance, filename):
    """Store repair evidence under an opaque name rather than a user filename."""
    extension = filename.rsplit(".", 1)[-1].lower()
    return f"evidence/{uuid.uuid4().hex}.{extension}"


def new_complaint_reference():
    """Generate a non-sequential public complaint reference."""
    return f"FM-{uuid.uuid4().hex.upper()}"


class Complaint(models.Model):
    """A citizen report; category routing and ownership are set by the server."""

    class Status(models.TextChoices):
        UNRESOLVED = "unresolved", "Unresolved"
        AWAITING_REVIEW = "awaiting_review", "Awaiting review"
        AWAITING_CONFIRMATION = "awaiting_confirmation", "Awaiting citizen confirmation"
        UNCERTAIN = "uncertain", "Validity uncertain"
        REJECTED = "rejected", "Rejected"
        COMPLETED = "completed", "Completed and citizen-confirmed"

    class Category(models.TextChoices):
        ROADS = "Roads & Footpaths", "Roads & Footpaths"
        WASTE = "Garbage & Waste", "Garbage & Waste"
        DRAINAGE = "Drainage & Waterlogging", "Drainage & Waterlogging"
        WATER = "Water Supply & Leakage", "Water Supply & Leakage"

    reference = models.CharField(
        max_length=35, unique=True, default=new_complaint_reference, editable=False
    )
    reporter = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="complaints"
    )
    category = models.CharField(max_length=40, choices=Category.choices)
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, related_name="complaints"
    )
    locality = models.ForeignKey(
        Locality, on_delete=models.PROTECT, related_name="complaints"
    )
    description = models.TextField(blank=True, validators=[MaxLengthValidator(1000)])
    photo = models.ImageField(
        upload_to=complaint_photo_path, blank=True, null=True, validators=[validate_image_upload]
    )
    status = models.CharField(
        max_length=25, choices=Status.choices, default=Status.AWAITING_REVIEW
    )
    deadline_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["department", "locality", "status"]),
        ]

    def clean(self):
        super().clean()
        if self.category and self.department_id:
            expected_code = CATEGORY_ROUTES.get(self.category)
            if expected_code and self.department.code != expected_code:
                raise ValidationError(
                    {"department": "Department must match the server-side category route."}
                )
        if self.description and len(self.description) > 1000:
            raise ValidationError({"description": "Description must be 1000 characters or fewer."})

    @property
    def is_overdue(self):
        """A complaint is overdue only when an explicit deadline has passed."""
        from django.utils import timezone

        return bool(
            self.deadline_at
            and self.deadline_at < timezone.now()
            and self.status
            not in {self.Status.COMPLETED, self.Status.REJECTED}
        )

    def __str__(self):
        return self.reference


class ComplaintStatusHistory(models.Model):
    """An append-only audit record for each server-accepted status transition."""

    complaint = models.ForeignKey(
        Complaint, on_delete=models.CASCADE, related_name="status_history"
    )
    previous_status = models.CharField(max_length=25, blank=True)
    new_status = models.CharField(max_length=25, choices=Complaint.Status.choices)
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, blank=True, null=True, related_name="status_changes"
    )
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.complaint.reference}: {self.new_status}"


class ProgressNote(models.Model):
    """A progress update written by an authorized official."""

    complaint = models.ForeignKey(
        Complaint, on_delete=models.CASCADE, related_name="progress_notes"
    )
    author = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="progress_notes"
    )
    text = models.TextField(validators=[MaxLengthValidator(2000)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Progress note for {self.complaint.reference}"


class RepairEvidence(models.Model):
    """Repair photo and note submitted by an official; never itself confirms completion."""

    complaint = models.ForeignKey(
        Complaint, on_delete=models.CASCADE, related_name="repair_evidence"
    )
    submitted_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="repair_evidence"
    )
    image = models.ImageField(upload_to=evidence_photo_path, validators=[validate_image_upload])
    explanation = models.TextField(blank=True, validators=[MaxLengthValidator(1000)])
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at", "-id"]

    def __str__(self):
        return f"Repair evidence for {self.complaint.reference}"


class CompletionConfirmation(models.Model):
    """The reporting citizen's explicit confirmation that evidence reflects a repair."""

    complaint = models.OneToOneField(
        Complaint, on_delete=models.CASCADE, related_name="completion_confirmation"
    )
    citizen = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="completion_confirmations"
    )
    comment = models.CharField(max_length=500, blank=True)
    confirmed_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        super().clean()
        if self.complaint_id and self.citizen_id:
            if self.complaint.reporter_id != self.citizen_id:
                raise ValidationError("Only the reporting citizen can confirm completion.")

    def __str__(self):
        return f"Citizen confirmation for {self.complaint.reference}"
