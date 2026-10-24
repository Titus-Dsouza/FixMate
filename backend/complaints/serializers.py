"""REST serializers with strict input handling and server-owned fields."""

from collections.abc import Mapping

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

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
from .validators import validate_image_upload


class StrictInputMixin:
    """Reject unknown or read-only fields instead of silently ignoring tampering."""

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            attempted_read_only = {
                key for key in data
                if key in self.fields and self.fields[key].read_only
            }
            unknown = set(data) - set(self.fields)
            errors = {key: ["This field cannot be changed."] for key in attempted_read_only}
            errors.update({key: ["Unknown field."] for key in unknown})
            if errors:
                raise serializers.ValidationError(errors)
        return super().to_internal_value(data)


class StrictModelSerializer(StrictInputMixin, serializers.ModelSerializer):
    """Model serializer that applies the strict input rule to all request payloads."""


class CitizenRegistrationSerializer(StrictModelSerializer):
    """Create citizens only; official scope is never accepted from the public API."""

    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ("email", "password", "first_name", "last_name")

    def validate(self, attrs):
        protected = {
            "role", "authorized_departments", "authorized_localities",
            "is_staff", "is_superuser", "groups", "user_permissions",
        }
        attempted = protected.intersection(self.initial_data)
        if attempted:
            raise serializers.ValidationError(
                {field: ["Only an administrator can set this field."] for field in attempted}
            )
        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from None
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(role=User.Role.CITIZEN, **validated_data)


class LoginSerializer(serializers.Serializer):
    """Validate the credentials used to establish a session."""

    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class UserSerializer(serializers.ModelSerializer):
    """Expose identity and official scope without exposing credentials."""

    authorized_departments = serializers.SlugRelatedField(
        many=True, read_only=True, slug_field="name"
    )
    authorized_localities = serializers.SlugRelatedField(
        many=True, read_only=True, slug_field="name"
    )

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "role",
            "authorized_departments", "authorized_localities",
        )
        read_only_fields = fields


class ComplaintSerializer(StrictModelSerializer):
    """Accept citizen report fields only; route and ownership fields stay server-owned."""

    locality = serializers.CharField(max_length=100)
    department = serializers.CharField(source="department.name", read_only=True)
    photo_name = serializers.CharField(source="photo.name", read_only=True, allow_null=True)
    reporter_id = serializers.IntegerField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Complaint
        fields = (
            "id", "reference", "reporter_id", "category", "department", "locality",
            "description", "photo", "photo_name", "status", "deadline_at",
            "is_overdue", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "reporter_id", "department", "photo_name",
            "status", "deadline_at", "is_overdue", "created_at", "updated_at",
        )

    def validate_photo(self, photo):
        validate_image_upload(photo)
        return photo

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        locality_name = " ".join(validated_data.pop("locality").split())
        locality_key = locality_name.casefold()
        locality, _ = Locality.objects.get_or_create(
            normalized_name=locality_key,
            defaults={"name": locality_name},
        )

        # Routing comes from the trusted category table, never from form data.
        department_code = CATEGORY_ROUTES[validated_data["category"]]
        department_names = dict(Department.Code.choices)
        department, _ = Department.objects.get_or_create(
            code=department_code,
            defaults={"name": department_names[department_code]},
        )
        complaint = Complaint.objects.create(
            reporter=request.user,
            department=department,
            locality=locality,
            status=Complaint.Status.AWAITING_REVIEW,
            **validated_data,
        )
        ComplaintStatusHistory.objects.create(
            complaint=complaint,
            previous_status="",
            new_status=complaint.status,
            actor=request.user,
        )
        return complaint


class StatusChangeSerializer(StrictInputMixin, serializers.Serializer):
    """Accept only a target status and optional audit note."""

    status = serializers.ChoiceField(choices=Complaint.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)

class ProgressNoteSerializer(StrictModelSerializer):
    """Display a note's author safely while allowing only the text to be submitted."""

    author_role = serializers.CharField(source="author.get_role_display", read_only=True)

    class Meta:
        model = ProgressNote
        fields = ("id", "text", "author_role", "created_at")
        read_only_fields = ("id", "author_role", "created_at")

    def validate_text(self, text):
        cleaned = text.strip()
        if not cleaned:
            raise serializers.ValidationError("Progress notes cannot be empty.")
        return cleaned


class RepairEvidenceSerializer(StrictModelSerializer):
    """Expose evidence metadata and accept a validated image plus optional explanation."""

    image_name = serializers.CharField(source="image.name", read_only=True)
    submitted_by_role = serializers.CharField(
        source="submitted_by.get_role_display", read_only=True
    )

    class Meta:
        model = RepairEvidence
        fields = ("id", "image", "image_name", "explanation", "submitted_by_role", "submitted_at")
        read_only_fields = ("id", "image_name", "submitted_by_role", "submitted_at")

    def validate_image(self, image):
        validate_image_upload(image)
        return image


class CompletionConfirmationSerializer(StrictModelSerializer):
    """Accept only an optional citizen comment."""

    class Meta:
        model = CompletionConfirmation
        fields = ("comment",)


class StatusHistorySerializer(serializers.ModelSerializer):
    """Show status events without disclosing account email addresses."""

    actor_role = serializers.CharField(source="actor.get_role_display", read_only=True, allow_null=True)

    class Meta:
        model = ComplaintStatusHistory
        fields = ("id", "previous_status", "new_status", "actor_role", "note", "created_at")
