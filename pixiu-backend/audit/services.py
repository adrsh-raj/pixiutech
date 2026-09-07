from .models import AuditLog


def record_audit(*, actor, action, entity_type, entity_id="", summary="", changes=None, request=None):
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id or ""),
        summary=summary.strip(),
        changes=changes or {},
        ip_address=(request.META.get("REMOTE_ADDR") if request else None),
        user_agent=(request.META.get("HTTP_USER_AGENT", "") if request else ""),
    )
