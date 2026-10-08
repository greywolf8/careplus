import pytest
from fastapi.testclient import TestClient
from careplus.api.main import app


client = TestClient(app)


def test_openapi_schema_exists():
    """Test that OpenAPI schema is generated."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "openapi" in schema
    assert "info" in schema
    assert "paths" in schema


def test_extract_endpoint_documented():
    """Test that /extract endpoint is documented in OpenAPI."""
    response = client.get("/openapi.json")
    schema = response.json()
    assert "/extract" in schema["paths"]
    extract_schema = schema["paths"]["/extract"]["post"]
    assert "summary" in extract_schema or "description" in extract_schema
    assert "requestBody" in extract_schema


def test_obligation_approve_endpoint_documented():
    """Test that /obligation/approve endpoint is documented."""
    response = client.get("/openapi.json")
    schema = response.json()
    assert "/obligation/approve" in schema["paths"]
    approve_schema = schema["paths"]["/obligation/approve"]["post"]
    assert "requestBody" in approve_schema


def test_obligation_close_endpoint_documented():
    """Test that /obligation/close endpoint is documented."""
    response = client.get("/openapi.json")
    schema = response.json()
    assert "/obligation/close" in schema["paths"]
    close_schema = schema["paths"]["/obligation/close"]["post"]
    assert "requestBody" in close_schema


def test_obligation_graph_endpoint_documented():
    """Test that /obligation/graph/{patient_id} endpoint is documented."""
    response = client.get("/openapi.json")
    schema = response.json()
    assert "/obligation/graph/{patient_id}" in schema["paths"]
    graph_schema = schema["paths"]["/obligation/graph/{patient_id}"]["get"]
    assert "parameters" in graph_schema


def test_extract_request_schema():
    """Test that ExtractRequest schema is properly defined."""
    response = client.get("/openapi.json")
    schema = response.json()
    # Check that the schema references the component
    extract_schema = schema["paths"]["/extract"]["post"]["requestBody"]["content"]["application/json"]["schema"]
    assert "$ref" in extract_schema
    # Check the component schema
    request_schema = schema["components"]["schemas"]["ExtractRequest"]
    assert "properties" in request_schema
    assert "patient_id" in request_schema["properties"]
    assert "raw_text" in request_schema["properties"]
    assert "discharge_date" in request_schema["properties"]


def test_extract_response_schema():
    """Test that ExtractResponse schema is properly defined."""
    response = client.get("/openapi.json")
    schema = response.json()
    # Check the component schema directly
    response_schema = schema["components"]["schemas"]["ExtractResponse"]
    assert "properties" in response_schema
    assert "items" in response_schema["properties"]
    assert "quality" in response_schema["properties"]
    assert "completeness" in response_schema["properties"]
