from .models import AuditLog


def record_audit(*, actor, action, app_label, model_name="", object_id="", method="", path="", status_code=None, ip_address=None, user_agent="", changes=None):
    return AuditLog.objects.create(
        actor=actor, action=action, app_label=app_label, model_name=model_name,
        object_id=str(object_id or ""), method=method, path=path, status_code=status_code,
        ip_address=ip_address, user_agent=user_agent or "", changes=changes or {},
    )
