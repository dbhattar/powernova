from rest_framework import throttling


class ContactUsThrottle(throttling.UserRateThrottle):
    scope = "contact_us"
    rate = "4/day"
