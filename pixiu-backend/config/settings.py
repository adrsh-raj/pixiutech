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
if not ALLOWED_HOSTS and os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS = [os.environ["RENDER_EXTERNAL_HOSTNAME"]]
elif not ALLOWED_HOSTS and DEBUG:
    ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

PERF_DIAGNOSTICS = os.environ.get("PERF_DIAGNOSTICS", "False").lower() == "true"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "performance_console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
        },
    },
    "loggers": {
        "performance": {
            "handlers": ["performance_console"],
            "level": "INFO",
            "propagate": False,
        },
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
    "django.contrib.sessions.middleware.SessionMiddleware", "django.middleware.common.CommonMiddleware", "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware", "django.contrib.messages.middleware.MessageMiddleware", "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
if PERF_DIAGNOSTICS:
    MIDDLEWARE.insert(-1, "core.performance_middleware.PerformanceDiagnosticsMiddleware")
ROOT_URLCONF = "config.urls"
TEMPLATES = [{"BACKEND":"django.template.backends.django.DjangoTemplates","DIRS":[],"APP_DIRS":True,"OPTIONS":{"context_processors":["django.template.context_processors.request","django.contrib.auth.context_processors.auth","django.contrib.messages.context_processors.messages"]}}]
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
DATABASES = {"default":{"ENGINE":"django.db.backends.postgresql","NAME":unquote(parsed.path.lstrip("/")),"USER":unquote(parsed.username or ""),"PASSWORD":unquote(parsed.password or ""),"HOST":parsed.hostname,"PORT":parsed.port or "5432","OPTIONS":DATABASE_OPTIONS,"CONN_MAX_AGE":int(os.environ.get("DJANGO_DB_CONN_MAX_AGE","60")),"CONN_HEALTH_CHECKS":True}}
EXPECTED_DATABASE_NAME = os.environ.get("DJANGO_EXPECTED_DATABASE_NAME", "").strip()
if EXPECTED_DATABASE_NAME and DATABASES["default"]["NAME"] != EXPECTED_DATABASE_NAME: raise RuntimeError("DATABASE_URL points to a database different from DJANGO_EXPECTED_DATABASE_NAME. Refusing to start to protect the Django rebuild from accidental legacy DB usage.")

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "TIMEOUT": int(os.environ.get("DJANGO_CACHE_TIMEOUT", "30")),
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "pixiu-django-cache",
            "TIMEOUT": int(os.environ.get("DJANGO_CACHE_TIMEOUT", "30")),
        }
    }

REST_FRAMEWORK = {"DEFAULT_AUTHENTICATION_CLASSES":["rest_framework_simplejwt.authentication.JWTAuthentication"],"DEFAULT_PERMISSION_CLASSES":["rest_framework.permissions.IsAuthenticated"],"DEFAULT_RENDERER_CLASSES":["rest_framework.renderers.JSONRenderer"],"DEFAULT_THROTTLE_CLASSES":["rest_framework.throttling.ScopedRateThrottle"],"DEFAULT_THROTTLE_RATES":{"login":os.environ.get("DJANGO_LOGIN_RATE","10/min")},"EXCEPTION_HANDLER":"core.exception_handler.custom_exception_handler"}
SIMPLE_JWT = {"ACCESS_TOKEN_LIFETIME":timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES","30"))),"REFRESH_TOKEN_LIFETIME":timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS","7"))),"ROTATE_REFRESH_TOKENS":True,"BLACKLIST_AFTER_ROTATION":True,"UPDATE_LAST_LOGIN":False,"AUTH_HEADER_TYPES":("Bearer",)}
CORS_ALLOWED_ORIGINS = [x.strip() for x in os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS","").split(",") if x.strip()]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [x.strip() for x in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS","").split(",") if x.strip()]
AUTH_PASSWORD_VALIDATORS = [{"NAME":"django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},{"NAME":"django.contrib.auth.password_validation.MinimumLengthValidator"},{"NAME":"django.contrib.auth.password_validation.CommonPasswordValidator"},{"NAME":"django.contrib.auth.password_validation.NumericPasswordValidator"}]
LANGUAGE_CODE="en-us"; TIME_ZONE="Asia/Kolkata"; USE_I18N=True; USE_TZ=True
STATIC_URL="static/"; STATIC_ROOT=BASE_DIR / "staticfiles"; MEDIA_URL="media/"; MEDIA_ROOT=BASE_DIR / "media"; DEFAULT_AUTO_FIELD="django.db.models.BigAutoField"
STORAGES = {"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"}, "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"}}
AWS_BUCKET = os.environ.get("AWS_STORAGE_BUCKET_NAME", "").strip()
if AWS_BUCKET:
    INSTALLED_APPS.append("storages")
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": {"bucket_name": AWS_BUCKET, "region_name": os.environ.get("AWS_S3_REGION_NAME") or None, "endpoint_url": os.environ.get("AWS_S3_ENDPOINT_URL") or None, "access_key_id": os.environ.get("AWS_ACCESS_KEY_ID") or None, "secret_access_key": os.environ.get("AWS_SECRET_ACCESS_KEY") or None, "location": os.environ.get("AWS_LOCATION", "pixiu-media").strip("/"), "file_overwrite": False, "querystring_auth": os.environ.get("AWS_QUERYSTRING_AUTH", "True").lower() == "true", "querystring_expire": int(os.environ.get("AWS_QUERYSTRING_EXPIRE", "3600"))}}
    MEDIA_URL = os.environ.get("AWS_CUSTOM_DOMAIN", "").strip()
    if MEDIA_URL and not MEDIA_URL.endswith("/"): MEDIA_URL += "/"

JWT_REFRESH_COOKIE_NAME = os.environ.get("JWT_REFRESH_COOKIE_NAME", "pixiu_refresh")
JWT_COOKIE_SECURE = os.environ.get("JWT_COOKIE_SECURE", "False" if DEBUG else "True").lower() == "true"
JWT_COOKIE_SAMESITE = os.environ.get("JWT_COOKIE_SAMESITE", "Lax" if DEBUG else "None")
JWT_REFRESH_COOKIE_PATH = "/api/v1/auth/refresh/"
JWT_REFRESH_COOKIE_MAX_AGE = int(os.environ.get("JWT_REFRESH_COOKIE_MAX_AGE", str(int(timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7"))).total_seconds()))))

CLOUDFLARE_TURNSTILE_SECRET_KEY = os.environ.get("CLOUDFLARE_TURNSTILE_SECRET_KEY", "").strip()
CLOUDFLARE_TURNSTILE_ENABLED = os.environ.get(
    "CLOUDFLARE_TURNSTILE_ENABLED",
    "False" if DEBUG else "True",
).lower() == "true"

SECURE_CONTENT_TYPE_NOSNIFF=True; X_FRAME_OPTIONS="DENY"; SECURE_REFERRER_POLICY="strict-origin-when-cross-origin"
if not DEBUG:
    SECURE_SSL_REDIRECT=os.environ.get("DJANGO_SECURE_SSL_REDIRECT","True").lower()=="true"; SESSION_COOKIE_SECURE=True; CSRF_COOKIE_SECURE=True; SECURE_HSTS_SECONDS=int(os.environ.get("DJANGO_HSTS_SECONDS","31536000")); SECURE_HSTS_INCLUDE_SUBDOMAINS=True; SECURE_HSTS_PRELOAD=True