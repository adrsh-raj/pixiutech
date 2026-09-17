"""Canonical programme-completion service.

Keep the public import path stable while the implementation lives in the
versioned engine.  All completion views import this module, so there must be
one source of truth for evaluation, review, approval and certificate rules.
"""

from .course_completion_v6 import *  # noqa: F401,F403
from .course_completion_v6 import (  # noqa: F401
    PASS_MARK,
    WEIGHT_ATTENDANCE,
    WEIGHT_PRACTICAL,
    WEIGHT_QUIZ,
    WEIGHT_TRAINER_REVIEW,
)
