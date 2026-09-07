from rest_framework.routers import DefaultRouter
from .views import LeadActivityViewSet, LeadContactViewSet, LeadViewSet
router=DefaultRouter(); router.register("leads",LeadViewSet,basename="crm-lead"); router.register("activities",LeadActivityViewSet,basename="lead-activity"); router.register("contacts",LeadContactViewSet,basename="lead-contact"); urlpatterns=router.urls
