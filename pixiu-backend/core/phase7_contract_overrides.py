from rest_framework.decorators import action

from .api_v1_compat import ContractSessionViewSet


_CURRICULUM_PREFIX = "__PIXIU_CURRICULUM_UNIT_ID__:"


def _strip_curriculum_meta(notes):
    value = str(notes or "")
    marker = value.find(_CURRICULUM_PREFIX)
    if marker < 0:
        return value, None
    tail = value[marker + len(_CURRICULUM_PREFIX):]
    unit_id = tail.split("__", 1)[0].strip()
    clean = (value[:marker] + (tail.split("__", 1)[1] if "__" in tail else "")).strip()
    return clean, unit_id or None


class ContractSessionCompatViewSet(ContractSessionViewSet):
    """Keep legacy unlock working and bind each class occurrence to its curriculum unit."""

    def map_in(self, data):
        payload = super().map_in(data)
        curriculum_id = data.get("curriculum_unit") or data.get("curriculum") or data.get("curriculum_unit_id")
        clean_notes, existing_id = _strip_curriculum_meta(data.get("notes", ""))
        curriculum_id = str(curriculum_id or existing_id or "").strip()
        if curriculum_id:
            payload["notes"] = f"{clean_notes} {_CURRICULUM_PREFIX}{curriculum_id}__".strip()
        else:
            payload["notes"] = clean_notes
        return payload

    def map_out(self, obj):
        payload = super().map_out(obj)
        clean_notes, curriculum_id = _strip_curriculum_meta(obj.notes)
        payload["notes"] = clean_notes
        payload["curriculum_unit"] = curriculum_id or ""
        return payload

    @action(detail=True, methods=["post", "put"], url_path="unlock")
    def unlock(self, request, pk=None):
        return super().unlock(request, pk=pk)
