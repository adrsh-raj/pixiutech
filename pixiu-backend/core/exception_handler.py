from rest_framework.views import exception_handler as drf_exception_handler


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, dict):
        detail = data.get("detail")
        fields = {key: value for key, value in data.items() if key != "detail"}
        if detail is None:
            if fields:
                detail = "Request validation failed."
            else:
                detail = "Request failed."
        response.data = {
            "success": False,
            "status": response.status_code,
            "error": str(detail),
            "detail": detail,
            **({"fields": fields} if fields else {}),
        }
    else:
        response.data = {
            "success": False,
            "status": response.status_code,
            "error": str(data),
            "detail": data,
        }
    return response
