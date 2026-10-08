import structlog
from careplus.core.config import settings


def configure_logging():
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.make_filtering_bound_logger(settings.log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )


configure_logging()
logger = structlog.get_logger()
