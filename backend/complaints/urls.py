"""Version-one API endpoints."""

from django.urls import path

from .views import (
    AreaReportView,
    AssignedComplaintsView,
    ComplaintDetailView,
    ComplaintEvidenceView,
    ComplaintHistoryView,
    ComplaintListCreateView,
    ComplaintNotesView,
    ComplaintPhotoView,
    ComplaintStatusView,
    ConfirmCompletionView,
    CurrentUserView,
    CsrfTokenView,
    EvidencePhotoView,
    LoginView,
    LogoutView,
    MyComplaintsView,
    RegisterView,
)

urlpatterns = [
    path("auth/csrf/", CsrfTokenView.as_view(), name="csrf-token"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", CurrentUserView.as_view(), name="current-user"),
    path("complaints/", ComplaintListCreateView.as_view(), name="complaint-list"),
    path("complaints/mine/", MyComplaintsView.as_view(), name="my-complaints"),
    path("complaints/assigned/", AssignedComplaintsView.as_view(), name="assigned-complaints"),
    path("complaints/<int:complaint_id>/", ComplaintDetailView.as_view(), name="complaint-detail"),
    path(
        "complaints/<int:complaint_id>/status/",
        ComplaintStatusView.as_view(),
        name="complaint-status",
    ),
    path(
        "complaints/<int:complaint_id>/history/",
        ComplaintHistoryView.as_view(),
        name="complaint-history",
    ),
    path(
        "complaints/<int:complaint_id>/notes/",
        ComplaintNotesView.as_view(),
        name="complaint-notes",
    ),
    path(
        "complaints/<int:complaint_id>/evidence/",
        ComplaintEvidenceView.as_view(),
        name="complaint-evidence",
    ),
    path(
        "complaints/<int:complaint_id>/photo/",
        ComplaintPhotoView.as_view(),
        name="complaint-photo",
    ),
    path(
        "complaints/<int:complaint_id>/evidence/<int:evidence_id>/photo/",
        EvidencePhotoView.as_view(),
        name="evidence-photo",
    ),
    path(
        "complaints/<int:complaint_id>/confirm/",
        ConfirmCompletionView.as_view(),
        name="complaint-confirm",
    ),
    path("area-reports/", AreaReportView.as_view(), name="area-reports"),
]
