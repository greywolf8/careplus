import pytest
from fastapi.testclient import TestClient
from careplus.api.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "dependencies" in data


def test_all_endpoints_exist():
    # Check that all endpoints are registered by checking OpenAPI schema
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi_schema = response.json()
    
    paths = openapi_schema.get("paths", {})
    
    expected_endpoints = [
        "/extract",
        "/translate",
        "/question/classify",
        "/question/answer/plan",
        "/question/answer/doctor",
        "/task/draft",
        "/verify/translation",
        "/verify/span",
        "/obligation/approve",
        "/obligation/close",
        "/obligation/graph/{patient_id}",
        "/episode/{patient_id}",
        "/consent/grant",
        "/consent/revoke",
        "/eval/metrics",
        "/admin/canary/seed",
        "/verify/audit",
    ]
    
    for endpoint in expected_endpoints:
        # For path parameters, the OpenAPI schema uses the parameterized version
        assert endpoint in paths, f"Endpoint {endpoint} not found in OpenAPI schema"


def test_schemas_import():
    from careplus.schemas import (
        ErrorCode,
        ErrorResponse,
        HealthResponse,
        ExtractRequest,
        ExtractResponse,
        TranslateRequest,
        TranslateResponse,
        ClassifyQuestionRequest,
        ClassifyQuestionResponse,
        DraftTaskRequest,
        DraftTaskResponse,
        VerifyTranslationRequest,
        VerifyTranslationResponse,
        ApproveObligationRequest,
        ApproveObligationResponse,
        CloseObligationRequest,
        CloseObligationResponse,
        EpisodeResponse,
        GrantConsentRequest,
        GrantConsentResponse,
        RevokeConsentRequest,
        RevokeConsentResponse,
        EvalMetric,
        EvalMetricsResponse,
        CanarySeedRequest,
        CanarySeedResponse,
        VerifyAuditResponse,
    )
    assert ErrorCode.EXTRACTION_UNAVAILABLE == "EXTRACTION_UNAVAILABLE"
    assert ErrorCode.TRANSLATION_UNAVAILABLE == "TRANSLATION_UNAVAILABLE"
    assert ErrorCode.INVALID_INPUT == "INVALID_INPUT"
    assert ErrorCode.NOT_AUTHORIZED == "NOT_AUTHORIZED"
    assert ErrorCode.ITEM_NOT_FOUND == "ITEM_NOT_FOUND"
    assert ErrorCode.QUESTION_ROUTING_FAILED == "QUESTION_ROUTING_FAILED"
    assert ErrorCode.INTERNAL_ERROR == "INTERNAL_ERROR"


def test_llm_client_import():
    from careplus.llm import LLMClient, OpenRouterClient
    assert LLMClient is not None
    assert OpenRouterClient is not None


def test_config_import():
    from careplus.core.config import settings
    assert settings is not None


def test_auth_import():
    from careplus.core.auth import verify_jwt, get_user_from_token
    assert verify_jwt is not None
    assert get_user_from_token is not None
