"""Small role and assignment checks shared by API views."""

from rest_framework.permissions import BasePermission

from .models import User


class IsCitizen(BasePermission):
    """Allow only citizen accounts to perform citizen-only actions."""

    message = "Only citizen accounts can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.CITIZEN
        )


class IsOfficial(BasePermission):
    """Allow only active official accounts to perform official actions."""

    message = "Only authorized government officials can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.OFFICIAL
            and request.user.is_active
        )
