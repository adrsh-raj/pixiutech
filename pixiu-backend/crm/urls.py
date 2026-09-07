from rest_framework.routers import DefaultRouter
from .views import LeadActivityViewSet, LeadViewSet

router = DefaultRouter()
router.register("leads", LeadViewSet, basename="crm-lead")
router.register("lead-activities", LeadActivityViewSet, basename="lead-activity")
urlpatterns = router.urls
