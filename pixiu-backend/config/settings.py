import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY must be configured.")
DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()]
DJANGO_ADMIN_ENABLED = os.environ.get("DJANGO_ADMIN_ENABLED", "True" if DEBUG else "False").lower() == "true"
DJANGO_ADMIN_PATH = os.environ.get("DJANGO_ADMIN_PATH", "admin" if DEBUG else "").strip().strip("/")
if not DEBUG and DJANGO_ADMIN_ENABLED and (not DJANGO_ADMIN_PATH or DJANGO_ADMIN_PATH.lower() == "admin"):
    raise RuntimeError("Production Django admin requires an explicit non-default DJANGO_ADMIN_PATH.")
if not ALLOWED_HOSTS and os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS = [os.environ["RENDER_EXTERNAL_HOSTNAME"]]
elif not ALLOWED_HOSTS and DEBUG:
    ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

PERF_DIAGNOSTICS = os.environ.get("PERF_DIAGNOSTICS", "False").lower() == "true"

# Portal security policy. The browser enforces the 10-minute inactivity timer;
# backend credentials are independently invalidated on password changes.
PORTAL_IDLE_TIMEOUT_SECONDS = int(os.environ.get("DJANGO_PORTAL_IDLE_TIMEOUT_SECONDS", "600"))

# Pixiu Tech billing profile. Keep these values in the server environment rather than source control.
PIXIU_BILLING_ACCOUNT_NAME = os.environ.get("PIXIU_BILLING_ACCOUNT_NAME", os.environ.get("PIXIU_BANK_ACCOUNT_NAME", "PIXIU TECH LLP")).strip()
PIXIU_BILLING_BANK_NAME = os.environ.get("PIXIU_BILLING_BANK_NAME", os.environ.get("PIXIU_BANK_NAME", "CENTRAL BANK OF INDIA")).strip()
PIXIU_BILLING_ACCOUNT_NUMBER = os.environ.get("PIXIU_BILLING_ACCOUNT_NUMBER", os.environ.get("PIXIU_BANK_ACCOUNT_NUMBER", "5599971440")).strip()
PIXIU_BILLING_IFSC = os.environ.get("PIXIU_BILLING_IFSC", os.environ.get("PIXIU_BANK_IFSC", "CBIN0282573")).strip()
PIXIU_BILLING_UPI = os.environ.get("PIXIU_BILLING_UPI", os.environ.get("PIXIU_UPI_ID", "")).strip()
LOGIN_MAX_FAILED_ATTEMPTS = int(os.environ.get("DJANGO_LOGIN_MAX_FAILED_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(os.environ.get("DJANGO_LOGIN_LOCKOUT_MINUTES", "15"))
PASSWORD_RESET_TIMEOUT = int(os.environ.get("DJANGO_PASSWORD_RESET_TIMEOUT", str(60 * 60)))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "performance_console": {"class": "logging.StreamHandler", "level": "INFO"},
        "security_console": {"class": "logging.StreamHandler", "level": "INFO"},
        "security_auth_console": {"class": "logging.StreamHandler", "level": "WARNING"},
    },
    "loggers": {
        "performance": {"handlers": ["performance_console"], "level": "INFO", "propagate": False},
        "security.uploads": {"handlers": ["security_console"], "level": "INFO", "propagate": False},
        "security.auth": {"handlers": ["security_auth_console"], "level": "WARNING", "propagate": False},
    },
}

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes", "django.contrib.sessions",
    "django.contrib.messages", "django.contrib.staticfiles", "corsheaders", "rest_framework",
    "rest_framework_simplejwt.token_blacklist", "core", "accounts", "academics", "learning",
    "billing", "inventory", "notifications", "crm", "audit",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware", "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware", "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware", "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
if PERF_DIAGNOSTICS:
    MIDDLEWARE.insert(-1, "core.performance_middleware.PerformanceDiagnosticsMiddleware")
ROOT_URLCONF = "config.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
AUTH_USER_MODEL = "accounts.User"

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL: raise RuntimeError("DATABASE_URL must be configured.")
parsed = urlparse(DATABASE_URL)
if parsed.scheme not in {"postgres", "postgresql"}: raise RuntimeError("DATABASE_URL must use a PostgreSQL URL.")
if not parsed.hostname or not parsed.path.lstrip("/"): raise RuntimeError("DATABASE_URL must include a PostgreSQL host and database name.")
query_options = parse_qs(parsed.query)
sslmode = (query_options.get("sslmode") or [os.environ.get("DJANGO_DB_SSLMODE", "")])[0]
DATABASE_OPTIONS = {"sslmode": sslmode} if sslmode else {}
DATABASES = {"default": {"ENGINE": "django.db.backends.postgresql", "NAME": unquote(parsed.path.lstrip("/")), "USER": unquote(parsed.username or ""), "PASSWORD": unquote(parsed.password or ""), "HOST": parsed.hostname, "PORT": parsed.port or "5432", "OPTIONS": DATABASE_OPTIONS, "CONN_MAX_AGE": int(os.environ.get("DJANGO_DB_CONN_MAX_AGE", "60")), "CONN_HEALTH_CHECKS": True}}
EXPECTED_DATABASE_NAME = os.environ.get("DJANGO_EXPECTED_DATABASE_NAME", "").strip()
if EXPECTED_DATABASE_NAME and DATABASES["default"]["NAME"] != EXPECTED_DATABASE_NAME:
    raise RuntimeError("DATABASE_URL points to a database different from DJANGO_EXPECTED_DATABASE_NAME. Refusing to start to protect the Django rebuild from accidental legacy DB usage.")

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
if REDIS_URL:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": REDIS_URL, "TIMEOUT": int(os.environ.get("DJANGO_CACHE_TIMEOUT", "30"))}}
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "pixiu-django-cache", "TIMEOUT": int(os.environ.get("DJANGO_CACHE_TIMEOUT", "30"))}
}

SECURE_UPLOAD_MAX_BYTES = int(os.environ.get("SECURE_UPLOAD_MAX_MB", "20")) * 1024 * 1024
CAREER_CV_MAX_BYTES = int(os.environ.get("CAREER_CV_MAX_MB", "2")) * 1024 * 1024
SECURE_UPLOAD_MAX_MULTIPART_BYTES = SECURE_UPLOAD_MAX_BYTES + 5 * 1024 * 1024
FILE_UPLOAD_HANDLERS = ["core.upload_security.SecureUploadSizeHandler", "django.core.files.uploadhandler.MemoryFileUploadHandler", "django.core.files.uploadhandler.TemporaryFileUploadHandler"]
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get("FILE_UPLOAD_MAX_MEMORY_MB", "5")) * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = SECURE_UPLOAD_MAX_MULTIPART_BYTES

CLAMAV_ENABLED = os.environ.get("CLAMAV_ENABLED", "False" if DEBUG else "True").lower() == "true"
CLAMAV_REQUIRED = os.environ.get("CLAMAV_REQUIRED", "False" if DEBUG else "True").lower() == "true"
CLAMAV_HOST = os.environ.get("CLAMAV_HOST", "127.0.0.1").strip()
CLAMAV_HOSTPORT = os.environ.get("CLAMAV_HOSTPORT", "").strip()
CLAMAV_PORT = int(os.environ.get("CLAMAV_PORT", "3310"))
CLAMAV_TIMEOUT_SECONDS = float(os.environ.get("CLAMAV_TIMEOUT_SECONDS", "30"))
CLAMAV_RETRY_ATTEMPTS = int(os.environ.get("CLAMAV_RETRY_ATTEMPTS", "3"))
CLAMAV_RETRY_BACKOFF_SECONDS = float(os.environ.get("CLAMAV_RETRY_BACKOFF_SECONDS", "1"))
CLAMAV_CHUNK_SIZE = int(os.environ.get("CLAMAV_CHUNK_SIZE", str(1024 * 1024)))

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.CachedJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser", "core.upload_security.SecureMultiPartParser", "rest_framework.parsers.FormParser"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"login": os.environ.get("DJANGO_LOGIN_RATE", "10/min"), "upload": os.environ.get("DJANGO_UPLOAD_RATE", "30/hour"), "trainer_material_upload": os.environ.get("DJANGO_TRAINER_MATERIAL_UPLOAD_RATE", "30/hour"), "career_apply": os.environ.get("DJANGO_CAREER_APPLY_RATE", "5/hour"), "public_enquiry": os.environ.get("DJANGO_PUBLIC_ENQUIRY_RATE", "10/hour"), "password_reset": os.environ.get("DJANGO_PASSWORD_RESET_RATE", "10/hour"), "student_password_reset": os.environ.get("DJANGO_STUDENT_PASSWORD_RESET_RATE", "20/hour"), "csrf_token": os.environ.get("DJANGO_CSRF_TOKEN_RATE", "30/hour")},
    "EXCEPTION_HANDLER": "core.exception_handler.custom_exception_handler",
}

# Public career applications are rate-limited and CVs are kept outside public static paths.

# Refresh sessions are role-isolated and deliberately non-rotating. This avoids
# concurrent-tab/device refresh races where one refresh invalidates another
# browser's refresh token. Logout still blacklists the explicitly selected token.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
_cors_env = [x.strip() for x in os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS", "").split(",") if x.strip()]
if "*" in _cors_env:
    raise RuntimeError("Wildcard CORS is forbidden for the credentialed Pixiu API.")
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(_cors_env + [
    "https://pixiutech.com",
    "https://www.pixiutech.com",
    "https://portal.pixiutech.com",
]))
CORS_ALLOW_CREDENTIALS = True
_csrf_env = [x.strip() for x in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if x.strip()]
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(_csrf_env + [
    "https://pixiutech.com",
    "https://www.pixiutech.com",
    "https://portal.pixiutech.com",
]))
AUTH_PASSWORD_VALIDATORS = [{"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"}, {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"}, {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"}, {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"}]
LANGUAGE_CODE = "en-us"; TIME_ZONE = "Asia/Kolkata"; USE_I18N = True; USE_TZ = True
STATIC_URL = "static/"; STATIC_ROOT = BASE_DIR / "staticfiles"; MEDIA_URL = "media/"; MEDIA_ROOT = BASE_DIR / "media"; DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
WHITENOISE_INDEX_FILE = False
FILE_UPLOAD_PERMISSIONS = 0o600
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o700
STORAGES = {"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"}, "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"}}
AWS_BUCKET = os.environ.get("AWS_STORAGE_BUCKET_NAME", "").strip()
if AWS_BUCKET:
    INSTALLED_APPS.append("storages")
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": {"bucket_name": AWS_BUCKET, "region_name": os.environ.get("AWS_S3_REGION_NAME") or None, "endpoint_url": os.environ.get("AWS_S3_ENDPOINT_URL") or None, "access_key_id": os.environ.get("AWS_ACCESS_KEY_ID") or None, "secret_access_key": os.environ.get("AWS_SECRET_ACCESS_KEY") or None, "location": os.environ.get("AWS_LOCATION", "pixiu-media").strip("/"), "file_overwrite": False, "querystring_auth": os.environ.get("AWS_QUERYSTRING_AUTH", "True").lower() == "true", "querystring_expire": int(os.environ.get("AWS_S3_QUERYSTRING_EXPIRE", "3600"))}}
    MEDIA_URL = os.environ.get("AWS_CUSTOM_DOMAIN", "").strip()
    if MEDIA_URL and not MEDIA_URL.endswith("/"): MEDIA_URL += "/"

JWT_REFRESH_COOKIE_NAME = os.environ.get("JWT_REFRESH_COOKIE_NAME", "pixiu_refresh")
JWT_COOKIE_SECURE = os.environ.get("JWT_COOKIE_SECURE", "False" if DEBUG else "True").lower() == "true"
# The production portal and API currently live on different origins, so the
# refresh cookie must remain cross-site capable and is protected by explicit
# CSRF validation on auth endpoints.
JWT_COOKIE_SAMESITE = os.environ.get("JWT_COOKIE_SAMESITE", "Lax" if DEBUG else "None")
JWT_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = os.environ.get("DJANGO_CSRF_COOKIE_SECURE", "False" if DEBUG else "True").lower() == "true"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = os.environ.get("DJANGO_CSRF_COOKIE_SAMESITE", "Lax" if DEBUG else "None")
CSRF_COOKIE_NAME = os.environ.get("DJANGO_CSRF_COOKIE_NAME", "pixiu_csrf")
# Send the role-specific refresh cookie to all auth endpoints so refresh and
# logout can both see and manage the same HttpOnly session.
JWT_REFRESH_COOKIE_PATH = "/api/v1/auth/"
JWT_REFRESH_COOKIE_MAX_AGE = int(os.environ.get("JWT_REFRESH_COOKIE_MAX_AGE", str(int(timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7"))).total_seconds()))))

CLOUDFLARE_TURNSTILE_SECRET_KEY = os.environ.get("CLOUDFLARE_TURNSTILE_SECRET_KEY", "").strip()
CLOUDFLARE_TURNSTILE_ENABLED = os.environ.get("CLOUDFLARE_TURNSTILE_ENABLED", "False" if DEBUG else "True").lower() == "true"
SECURE_CONTENT_TYPE_NOSNIFF = True; X_FRAME_OPTIONS = "DENY"; SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = os.environ.get("DJANGO_SESSION_COOKIE_SAMESITE", "Lax")

if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "True").lower() == "true"; SESSION_COOKIE_SECURE = True; CSRF_COOKIE_SECURE = True; SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "31536000")); SECURE_HSTS_INCLUDE_SUBDOMAINS = True; SECURE_HSTS_PRELOAD = True
