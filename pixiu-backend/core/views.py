from django.db import connection
from django.http import JsonResponse


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return JsonResponse({"status": "ok", "service": "pixiu-django", "database": "ok"})
    except Exception:
        return JsonResponse({"status": "error", "service": "pixiu-django", "database": "unavailable"}, status=503)
