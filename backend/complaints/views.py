"""Authenticated API views for citizen and authorized-official workflows."""

import mimetypes

from django.contrib.auth import authenticate, login, logout
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count
from django.http import FileResponse, Http404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.cache import never_cache
from django.middleware.csrf import get_token
from rest_framework import generics, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Complaint,
    ComplaintStatusHistory,
    CompletionConfirmation,
    ProgressNote,
    RepairEvidence,
    User,
)
from .permissions import IsCitizen, IsOfficial
from .serializers import (
    CitizenRegistrationSerializer,
    CompletionConfirmationSerializer,
    ComplaintSerializer,
    LoginSerializer,
    ProgressNoteSerializer,
    RepairEvidenceSerializer,
    StatusChangeSerializer,
    StatusHistorySerializer,
    UserSerializer,
)


def complaints_visible_to(user):
    """Return only complaints the authenticated role is allowed to see."""
    if user.role == User.Role.CITIZEN:
        return Complaint.objects.filter(reporter=user)
    if user.role == User.Role.OFFICIAL:
        return Complaint.objects.filter(
            department__in=user.authorized_departments.all(),
            locality__in=user.authorized_localities.all(),
        ).distinct()
    return Complaint.objects.none()


def get_visible_complaint(user, complaint_id):
    """Use the role-scoped queryset for every nested complaint action."""
    try:
        return complaints_visible_to(user).get(pk=complaint_id)
    except Complaint.DoesNotExist:
        raise Http404("Complaint not found.") from None


def record_transition(complaint, new_status, actor, note=""):
    """Save a status change and append one append-only audit row.

    This helper only performs the storage work. Callers are responsible for
    deciding that the transition itself is allowed, so each workflow can apply
    its own rule (official review rules, evidence rules, citizen confirmation).
    """
    previous_status = complaint.status
    complaint.status = new_status
    complaint.save(update_fields=["status", "updated_at"])
    ComplaintStatusHistory.objects.create(
        complaint=complaint,
        previous_status=previous_status,
        new_status=new_status,
        actor=actor,
        note=note,
    )


def transition_status(complaint, new_status, actor, note=""):
    """Persist an allowed official review transition with its audit record.

    Officials may move a complaint between review states, but they can never
    mark a complaint completed: only the reporting citizen does that.
    """
    if new_status == complaint.status:
        raise serializers.ValidationError({"status": "Complaint already has this status."})

    # Which review moves an assigned official is allowed to make.
    official_transitions = {
        Complaint.Status.AWAITING_REVIEW: {
            Complaint.Status.UNRESOLVED, Complaint.Status.UNCERTAIN, Complaint.Status.REJECTED,
        },
        Complaint.Status.UNRESOLVED: {
            Complaint.Status.AWAITING_REVIEW, Complaint.Status.UNCERTAIN, Complaint.Status.REJECTED,
        },
        Complaint.Status.UNCERTAIN: {
            Complaint.Status.AWAITING_REVIEW, Complaint.Status.UNRESOLVED, Complaint.Status.REJECTED,
        },
        Complaint.Status.AWAITING_CONFIRMATION: {
            Complaint.Status.UNRESOLVED, Complaint.Status.UNCERTAIN, Complaint.Status.REJECTED,
        },
    }
    if new_status not in official_transitions.get(complaint.status, set()):
        raise serializers.ValidationError(
            {"status": "This status transition is not allowed for an official."}
        )

    record_transition(complaint, new_status, actor, note)


class CsrfTokenView(APIView):
    """Give browser clients a CSRF cookie and token before session-authenticated POSTs."""

    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def dispatch(self, *args, **kwargs):
        """Set the browser cookie while Django still has the original request."""
        return super().dispatch(*args, **kwargs)

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(generics.CreateAPIView):
    """Public registration creates citizen accounts only."""

    permission_classes = [AllowAny]
    serializer_class = CitizenRegistrationSerializer

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)


class LoginView(APIView):
    """Authenticate using a Django session; never reveal which credential was wrong."""

    permission_classes = [AllowAny]

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None or not user.is_active:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        return Response({"user": UserSerializer(user).data, "csrfToken": get_token(request)})


class LogoutView(APIView):
    """End the current session; SessionAuthentication enforces CSRF on this POST."""

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(APIView):
    """Return the authenticated account and server-provisioned official scope."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ComplaintListCreateView(generics.ListCreateAPIView):
    """List only role-visible complaints and accept reports from citizens."""

    serializer_class = ComplaintSerializer

    def get_queryset(self):
        return complaints_visible_to(self.request.user).select_related(
            "reporter", "department", "locality"
        )

    def perform_create(self, serializer):
        if self.request.user.role != User.Role.CITIZEN:
            raise PermissionDenied("Only citizens can submit complaints.")
        serializer.save()


class MyComplaintsView(generics.ListAPIView):
    """List complaints owned by the signed-in citizen."""

    serializer_class = ComplaintSerializer
    permission_classes = [IsAuthenticated, IsCitizen]

    def get_queryset(self):
        return Complaint.objects.filter(reporter=self.request.user).select_related(
            "reporter", "department", "locality"
        )


class AssignedComplaintsView(generics.ListAPIView):
    """List only cases matching both an official's authorized department and locality."""

    serializer_class = ComplaintSerializer
    permission_classes = [IsAuthenticated, IsOfficial]

    def get_queryset(self):
        return complaints_visible_to(self.request.user).select_related(
            "reporter", "department", "locality"
        )


class ComplaintDetailView(generics.RetrieveAPIView):
    """Return a complaint only when it is inside the caller's server-side scope."""

    serializer_class = ComplaintSerializer
    # The URL calls this parameter complaint_id, so read the lookup from there.
    lookup_url_kwarg = "complaint_id"

    def get_queryset(self):
        return complaints_visible_to(self.request.user).select_related(
            "reporter", "department", "locality"
        )


class ComplaintStatusView(APIView):
    """Let assigned officials review cases without permitting direct completion."""

    permission_classes = [IsAuthenticated, IsOfficial]

    @transaction.atomic
    def post(self, request, complaint_id):
        complaint = get_visible_complaint(request.user, complaint_id)
        complaint = Complaint.objects.select_for_update().get(pk=complaint.pk)
        serializer = StatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transition_status(
            complaint,
            serializer.validated_data["status"],
            request.user,
            serializer.validated_data.get("note", ""),
        )
        return Response(ComplaintSerializer(complaint).data)


class ComplaintHistoryView(generics.ListAPIView):
    """Expose history only to the reporting citizen or an assigned official."""

    serializer_class = StatusHistorySerializer

    def get_queryset(self):
        complaint = get_visible_complaint(self.request.user, self.kwargs["complaint_id"])
        return ComplaintStatusHistory.objects.filter(complaint=complaint).select_related("actor")


class ComplaintNotesView(generics.ListCreateAPIView):
    """Let assigned officials write notes and both authorized parties read them."""

    serializer_class = ProgressNoteSerializer

    def get_complaint(self):
        return get_visible_complaint(self.request.user, self.kwargs["complaint_id"])

    def get_queryset(self):
        return ProgressNote.objects.filter(complaint=self.get_complaint()).select_related("author")

    def create(self, request, *args, **kwargs):
        if request.user.role != User.Role.OFFICIAL:
            raise PermissionDenied("Only government officials can add progress notes.")
        complaint = self.get_complaint()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(complaint=complaint, author=request.user)
        return Response(self.get_serializer(note).data, status=status.HTTP_201_CREATED)


class ComplaintEvidenceView(generics.ListCreateAPIView):
    """Let assigned officials submit repair evidence without completing the case."""

    serializer_class = RepairEvidenceSerializer

    def get_complaint(self):
        return get_visible_complaint(self.request.user, self.kwargs["complaint_id"])

    def get_queryset(self):
        return RepairEvidence.objects.filter(complaint=self.get_complaint()).select_related(
            "submitted_by"
        )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role != User.Role.OFFICIAL:
            raise PermissionDenied("Only government officials can upload repair evidence.")
        complaint = Complaint.objects.select_for_update().get(pk=self.get_complaint().pk)
        if complaint.status not in {
            Complaint.Status.UNRESOLVED,
            Complaint.Status.AWAITING_REVIEW,
            Complaint.Status.AWAITING_CONFIRMATION,
        }:
            raise serializers.ValidationError(
                {"status": "Evidence cannot be added to a rejected or completed complaint."}
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evidence = serializer.save(complaint=complaint, submitted_by=request.user)
        # Submitting evidence moves the case to "awaiting citizen confirmation".
        # This is the evidence workflow, not an official review decision, so it
        # records the change directly instead of using the review transition table.
        if complaint.status != Complaint.Status.AWAITING_CONFIRMATION:
            record_transition(
                complaint,
                Complaint.Status.AWAITING_CONFIRMATION,
                request.user,
                "Repair evidence submitted; citizen confirmation is required.",
            )
        return Response(self.get_serializer(evidence).data, status=status.HTTP_201_CREATED)


class ConfirmCompletionView(APIView):
    """Allow the reporting citizen, and only that citizen, to confirm a repair."""

    permission_classes = [IsAuthenticated, IsCitizen]

    @transaction.atomic
    def post(self, request, complaint_id):
        complaint = get_visible_complaint(request.user, complaint_id)
        complaint = Complaint.objects.select_for_update().get(pk=complaint.pk)
        if complaint.status != Complaint.Status.AWAITING_CONFIRMATION:
            raise serializers.ValidationError(
                {"status": "This complaint is not awaiting citizen confirmation."}
            )
        serializer = CompletionConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        confirmation = serializer.save(complaint=complaint, citizen=request.user)
        # Only the reporting citizen can complete a complaint, and only from the
        # awaiting-confirmation state checked just above.
        record_transition(
            complaint,
            Complaint.Status.COMPLETED,
            request.user,
            confirmation.comment,
        )
        return Response(ComplaintSerializer(complaint).data)


class ComplaintPhotoView(APIView):
    """Serve private complaint images only to an owner or an assigned official."""

    @method_decorator(never_cache)
    def get(self, request, complaint_id):
        complaint = get_visible_complaint(request.user, complaint_id)
        if not complaint.photo:
            raise Http404("Photo not found.")
        return self._file_response(complaint.photo.name)

    @staticmethod
    def _file_response(name):
        if not default_storage.exists(name):
            raise Http404("Photo not found.")
        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        response = FileResponse(
            default_storage.open(name, "rb"),
            content_type=content_type,
            as_attachment=True,
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response


class EvidencePhotoView(ComplaintPhotoView):
    """Serve repair photos using the same role-scoped access policy as their complaint."""

    @method_decorator(never_cache)
    def get(self, request, complaint_id, evidence_id):
        complaint = get_visible_complaint(request.user, complaint_id)
        try:
            evidence = complaint.repair_evidence.get(pk=evidence_id)
        except RepairEvidence.DoesNotExist:
            raise Http404("Evidence not found.") from None
        if not evidence.image:
            raise Http404("Photo not found.")
        return self._file_response(evidence.image.name)


class AreaReportView(APIView):
    """Return locality-level counts only; never expose private complaint details publicly."""

    permission_classes = [AllowAny]

    def get(self, request):
        grouped = (
            Complaint.objects.values("locality__name", "status")
            .annotate(total=Count("id"))
            .order_by("locality__name", "status")
        )
        report_by_locality = {}
        for row in grouped:
            name = row["locality__name"]
            report = report_by_locality.setdefault(
                name, {"locality": name, "total": 0, "by_status": {}}
            )
            report["total"] += row["total"]
            report["by_status"][row["status"]] = row["total"]

        reports = list(report_by_locality.values())
        paginator = self.paginator
        page = paginator.paginate_queryset(reports, request, view=self)
        return paginator.get_paginated_response(page)

    @property
    def paginator(self):
        from rest_framework.pagination import PageNumberPagination

        if not hasattr(self, "_paginator"):
            self._paginator = PageNumberPagination()
            self._paginator.page_size = 20
            self._paginator.max_page_size = 100
        return self._paginator
