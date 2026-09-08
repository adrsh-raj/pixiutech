from .models import AuditAction, AuditLog


def record_audit(*, actor, action, entity_type, entity_id="", summary="", changes=None, request=None):
    normalized_entity = str(entity_type or "")
    normalized_summary = summary.strip()
    if normalized_entity == "AttendanceRecord" and normalized_summary.lower().startswith("admin attendance correction"):
        action = AuditAction.ATTENDANCE_OVERRIDE
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=normalized_entity,
        entity_id=str(entity_id or ""),
        summary=normalized_summary,
        changes=changes or {},
        ip_address=(request.META.get("REMOTE_ADDR") if request else None),
        user_agent=(request.META.get("HTTP_USER_AGENT", "") if request else ""),
    )
