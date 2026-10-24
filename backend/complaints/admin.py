"""Administrator-only management for identities and assignment reference data."""

from django import forms
from django.contrib import admin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.contrib.auth.admin import UserAdmin

from .models import (
    Complaint,
    ComplaintStatusHistory,
    CompletionConfirmation,
    Department,
    Locality,
    ProgressNote,
    RepairEvidence,
    User,
)


class AdminUserCreationForm(UserCreationForm):
    """Use the custom user's email field when creating official accounts."""

    role = forms.ChoiceField(choices=User.Role.choices)

    class Meta:
        model = User
        fields = ("email", "role")


class AdminUserChangeForm(UserChangeForm):
    """Bind Django's standard password-aware change form to FixMate users."""

    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class FixMateUserAdmin(UserAdmin):
    """Only Django administrators can provision official roles and assignment scope."""

    form = AdminUserChangeForm
    add_form = AdminUserCreationForm
    ordering = ("email",)
    list_display = ("email", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    filter_horizontal = ("authorized_departments", "authorized_localities", "groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        ("Role and authorized scope", {
            "fields": ("role", "authorized_departments", "authorized_localities")
        }),
        ("Permissions", {
            "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")
        }),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role")}),
    )


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code")
    ordering = ("name",)


@admin.register(Locality)
class LocalityAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)


class StatusHistoryInline(admin.TabularInline):
    model = ComplaintStatusHistory
    extra = 0
    readonly_fields = ("previous_status", "new_status", "actor", "note", "created_at")
    can_delete = False


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ("reference", "category", "department", "locality", "status", "created_at")
    list_filter = ("status", "department", "locality", "category")
    search_fields = ("reference", "description")
    readonly_fields = (
        "reference", "reporter", "category", "department", "locality",
        "status", "created_at",
    )
    inlines = (StatusHistoryInline,)


admin.site.register(ProgressNote)
admin.site.register(RepairEvidence)
admin.site.register(CompletionConfirmation)
