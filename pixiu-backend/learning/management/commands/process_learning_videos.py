import logging
import time
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from learning.models import LearningContent
from learning.video_processing import delete_object, delete_final_object, process_video_content, temp_bucket


logger = logging.getLogger(__name__)

POLL_SECONDS = 5
STALE_AFTER = timedelta(minutes=90)


class Command(BaseCommand):
    help = "Process queued learning videos: compress, scan, store final MP4, delete temporary original."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process one available video and exit.")
        parser.add_argument("--poll", type=float, default=POLL_SECONDS, help="Seconds to wait between polling cycles.")

    def _claim(self):
        now = timezone.now()
        with transaction.atomic():
            # A crashed worker can leave a job in processing. Reclaim it after
            # a generous timeout rather than leaving the video permanently stuck.
            stale = LearningContent.objects.filter(
                content_type="video",
                video_processing_status=LearningContent.VIDEO_PROCESSING_PROCESSING,
                video_processing_started_at__lt=now - STALE_AFTER,
            )
            stale.update(
                video_processing_status=LearningContent.VIDEO_PROCESSING_QUEUED,
                video_processing_started_at=None,
                video_processing_error="",
            )

            job = (
                LearningContent.objects.select_for_update(skip_locked=True)
                .filter(
                    content_type="video",
                    video_processing_status=LearningContent.VIDEO_PROCESSING_QUEUED,
                )
                .order_by("created_at")
                .first()
            )
            if not job:
                return None

            job.video_processing_status = LearningContent.VIDEO_PROCESSING_PROCESSING
            job.video_processing_started_at = now
            job.video_processing_error = ""
            job.save(update_fields=["video_processing_status", "video_processing_started_at", "video_processing_error", "updated_at"])
            return str(job.pk)

    def _process_one(self):
        content_id = self._claim()
        if not content_id:
            return False

        self.stdout.write(f"Picked queued video: {content_id}")
        self.stdout.flush()

        temp_key = ""
        try:
            content_before = LearningContent.objects.get(pk=content_id)
            temp_key = str(content_before.video_temp_key or "").strip()
            self.stdout.write(f"Processing video: {content_id}")
            self.stdout.flush()
            result = process_video_content(content_id)
            with transaction.atomic():
                content = LearningContent.objects.select_for_update().get(pk=content_id)
                old_key = str(content.file.name or "").strip()
                content.file.name = result["file_key"]
                content.video_processing_status = LearningContent.VIDEO_PROCESSING_READY
                content.video_processing_error = ""
                content.video_temp_key = ""
                content.video_duration_seconds = result["duration"]
                content.video_size_bytes = result["size"]
                content.video_width = result["width"]
                content.video_height = result["height"]
                content.video_ready_at = timezone.now()
                content.video_processing_started_at = None
                content.status = content.video_requested_status or "published"
                content.video_requested_status = ""
                content.save(update_fields=[
                    "file", "video_processing_status", "video_processing_error",
                    "video_temp_key", "video_duration_seconds", "video_size_bytes",
                    "video_width", "video_height", "video_ready_at",
                    "video_processing_started_at", "status", "video_requested_status",
                    "updated_at",
                ])

            if old_key and old_key != result["file_key"]:
                try:
                    delete_final_object(old_key)
                except Exception:
                    logger.exception("Could not delete previous final video object for %s", content_id)

            if temp_key:
                try:
                    delete_object(temp_bucket(), temp_key)
                except Exception:
                    logger.exception("Could not delete temporary source video %s", temp_key)

            self.stdout.write(self.style.SUCCESS(f"Video ready: {content_id}"))
            self.stdout.flush()
            return True
        except Exception as exc:
            logger.exception("Learning video processing failed: %s", content_id)
            try:
                with transaction.atomic():
                    content = LearningContent.objects.select_for_update().get(pk=content_id)
                    temp_key = str(content.video_temp_key or "").strip()
                    content.video_processing_status = LearningContent.VIDEO_PROCESSING_FAILED
                    content.video_processing_error = str(exc)[:4000]
                    content.video_processing_started_at = None
                    content.status = "draft"
                    content.video_requested_status = content.video_requested_status or "published"
                    content.save(update_fields=[
                        "video_processing_status", "video_processing_error",
                        "video_processing_started_at", "status", "video_requested_status",
                        "updated_at",
                    ])
                if temp_key:
                    try:
                        delete_object(temp_bucket(), temp_key)
                    except Exception:
                        logger.exception("Could not delete failed temporary video %s", temp_key)
            except LearningContent.DoesNotExist:
                pass
            return True

    def handle(self, *args, **options):
        once = bool(options["once"])
        poll = max(1.0, float(options["poll"]))

        self.stdout.write(self.style.SUCCESS("PIXIU learning video worker started."))
        while True:
            did_work = self._process_one()
            if once or did_work:
                if once:
                    return
                if did_work:
                    continue
            time.sleep(poll)
