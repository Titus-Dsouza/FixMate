"""URL routes for the admin site and REST API."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("complaints.urls")),
]
