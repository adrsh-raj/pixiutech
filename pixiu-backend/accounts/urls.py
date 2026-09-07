from django.urls import path

from .views import (
    ChangeOwnPasswordView,
    LoginView,
    LogoutView,
    ManagedAccountView,
    ManagedPasswordResetView,
    MeView,
    RefreshView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("password/change/", ChangeOwnPasswordView.as_view(), name="password-change"),
    path("credentials/manage/", ManagedAccountView.as_view(), name="managed-account"),
    path(
        "credentials/manage/<str:username>/reset/",
        ManagedPasswordResetView.as_view(),
        name="managed-password-reset",
    ),
]
