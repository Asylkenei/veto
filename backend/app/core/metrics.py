"""Prometheus metrics exposed at /metrics."""
from prometheus_client import Counter, Gauge, Histogram

HTTP_REQUESTS = Counter(
    "veto_http_requests_total", "HTTP requests", ["method", "route", "status"]
)
HTTP_LATENCY = Histogram(
    "veto_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)
DOMAIN_EVENTS = Counter("veto_domain_events_total", "Business events", ["event"])
SSE_CONNECTIONS = Gauge("veto_sse_connections", "Open live-update streams")
PUSH_SENT = Counter("veto_push_sent_total", "Web push delivery attempts", ["result"])
APP_ERRORS = Counter("veto_unhandled_errors_total", "Unhandled exceptions")
