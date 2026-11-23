"""
Atomic Shared Redis-Backed Rate Limiter for Xen / PixiuMind Step-700.
Enforces cross-process 60 requests/minute budget.
Fails closed (HTTP 503 RATE_LIMITER_UNAVAILABLE) if Redis is unavailable or unconfigured when Xen is active.
"""

import logging
import os
import time
from typing import Tuple

from django.conf import settings

logger = logging.getLogger("security.xen.ratelimit")


def check_xen_rate_limit(
    user_id: str,
    limit: int = 60,
    window_seconds: int = 60,
) -> Tuple[bool, int, str]:
    """
    Atomically check and increment the rate limit counter for a user in Redis.
    
    Returns:
        (is_allowed: bool, current_count: int, error_code: str)
        - If allowed: (True, current_count, "")
        - If rate limit exceeded: (False, current_count, "RATE_LIMIT_EXCEEDED")
        - If Redis unconfigured/down: (False, 0, "RATE_LIMITER_UNAVAILABLE")
    """
    redis_url = getattr(settings, "REDIS_URL", "").strip() or os.environ.get("REDIS_URL", "").strip()
    if not redis_url:
        logger.error("Xen rate limit check failed: REDIS_URL is unconfigured. Fail closed enforced.")
        return False, 0, "RATE_LIMITER_UNAVAILABLE"

    try:
        import redis
        client = redis.Redis.from_url(redis_url, socket_timeout=2.0, socket_connect_timeout=2.0)
        current_minute = int(time.time() // window_seconds)
        key = f"xen:ratelimit:{user_id}:{current_minute}"

        # Atomic transaction: INCR and EXPIRE within pipeline
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds * 2)
        results = pipe.execute()
        count = results[0]

        if count > limit:
            logger.warning(
                f"Xen rate limit exceeded for user {user_id}: count={count}, limit={limit}"
            )
            return False, count, "RATE_LIMIT_EXCEEDED"

        return True, count, ""

    except Exception as e:
        logger.error(f"Xen rate limit Redis connection error: {e}. Fail closed enforced.", exc_info=True)
        return False, 0, "RATE_LIMITER_UNAVAILABLE"
