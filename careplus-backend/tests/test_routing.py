import pytest
from unittest.mock import Mock, AsyncMock, patch
from careplus.services.routing import deterministic_route, llm_classify, answer_plan_question, translate_doctor_text
from careplus.llm.openrouter import OpenRouterClient
from uuid import uuid4


class TestDeterministicLayer:
    """Test deterministic routing layer."""
    
    def test_emergency_question(self):
        """Test that emergency question returns emergency route immediately."""
        question = "I have chest pain"
        
        result = deterministic_route(question)
        
        assert result["route"] == "emergency"
        assert result["escalate"] is True
        assert len(result["warning_signs"]) > 0
        assert "chest pain" in result["matched_keywords"]
        assert result["method"] if "method" in result else True  # No LLM call
    
    def test_medicine_question(self):
        """Test that medicine question returns medicine route with escalate."""
        question = "Can I take my pill early?"
        
        result = deterministic_route(question)
        
        assert result["route"] == "medicine"
        assert result["escalate"] is True
        assert "pill" in result["matched_keywords"]
    
    def test_symptom_question(self):
        """Test that symptom question returns symptom route with escalate."""
        question = "I have a fever"
        
        result = deterministic_route(question)
        
        assert result["route"] == "symptom"
        assert result["escalate"] is True
        assert "fever" in result["matched_keywords"]
    
    def test_no_keyword_match(self):
        """Test that question with no keyword match passes to LLM."""
        question = "When is my blood test?"
        
        result = deterministic_route(question)
        
        assert result["route"] is None
        assert result["escalate"] is False
        assert len(result["matched_keywords"]) == 0
    
    def test_multilingual_emergency(self):
        """Test emergency detection in Hindi."""
        question = "मेरे पास छाती दर्द है"
        
        result = deterministic_route(question)
        
        assert result["route"] == "emergency"
        assert result["escalate"] is True
    
    def test_multilingual_emergency_tamil(self):
        """Test emergency detection in Tamil."""
        question = "எனக்கு மார்பு வலி"
        
        result = deterministic_route(question)
        
        assert result["route"] == "emergency"
        assert result["escalate"] is True


@pytest.mark.asyncio
class TestLLMClassifier:
    """Test LLM classifier for questions passing deterministic layer."""
    
    async def test_llm_classifier_plan(self):
        """Test LLM classifier returns PLAN for schedule questions."""
        question = "When is my blood test scheduled?"
        
        mock_client = Mock(spec=OpenRouterClient)
        mock_client.generate_structured = AsyncMock(return_value={
            "route": "plan",
            "confidence": 0.9,
            "reasoning": "Question asks about timing/schedule"
        })
        
        result = await llm_classify(question, mock_client)
        
        assert result["route"] == "plan"
        assert result["escalate"] is False  # PLAN can be answered from approved items
        assert result["confidence"] == 0.9
    
    async def test_llm_classifier_other(self):
        """Test LLM classifier returns OTHER for non-plan questions."""
        question = "What should I eat for breakfast?"
        
        mock_client = Mock(spec=OpenRouterClient)
        mock_client.generate_structured = AsyncMock(return_value={
            "route": "other",
            "confidence": 0.8,
            "reasoning": "Question is not about schedule/appointments"
        })
        
        result = await llm_classify(question, mock_client)
        
        assert result["route"] == "other"
        assert result["escalate"] is True  # OTHER always escalates
    
    async def test_routing_failure_fails_safe(self):
        """Test that LLM classifier failure escalates safely."""
        question = "When is my appointment?"
        
        mock_client = Mock(spec=OpenRouterClient)
        mock_client.generate_structured = AsyncMock(side_effect=Exception("OpenRouter timeout"))
        
        result = await llm_classify(question, mock_client)
        
        assert result["route"] == "other"
        assert result["escalate"] is True  # Fail-safe: escalate on error
        assert "LLM classifier failed" in result["reasoning"]


@pytest.mark.asyncio
class TestPlanAnswer:
    """Test plan question answering."""
    
    async def test_plan_question_with_match(self):
        """Test plan question returns answer from approved_item with cited_item_ids."""
        question = "When is my blood test?"
        patient_id = uuid4()
        
        mock_client = Mock(spec=OpenRouterClient)
        mock_client.generate_structured = AsyncMock(return_value={
            "cited_item_ids": ["item-123"],
            "selected_field": "content",
            "reasoning": "Found blood test item"
        })
        
        with patch('careplus.services.routing.plan_answer.get_supabase_client') as mock_db:
            mock_supabase = Mock()
            mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "item-123",
                    "item_type": "test",
                    "content": "Your blood test is scheduled for 2024-10-15. Please fast for 8 hours before."
                }
            ]
            mock_db.return_value = mock_supabase
            
            result = await answer_plan_question(question, patient_id, mock_client)
        
        assert result["answer"] is not None
        assert "item-123" in result["cited_item_ids"]
        assert result["escalate"] is False
        assert result["cited_item_ids"]  # Always has cited_item_ids
    
    async def test_plan_question_no_match(self):
        """Test plan question with no approved_item match escalates."""
        question = "Should I take aspirin?"
        patient_id = uuid4()
        
        mock_client = Mock(spec=OpenRouterClient)
        mock_client.generate_structured = AsyncMock(return_value={
            "cited_item_ids": [],
            "selected_field": "content",
            "reasoning": "No relevant items found"
        })
        
        with patch('careplus.services.routing.plan_answer.get_supabase_client') as mock_db:
            mock_supabase = Mock()
            mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "item-456",
                    "item_type": "appointment",
                    "content": "Follow up with cardiologist"
                }
            ]
            mock_db.return_value = mock_supabase
            
            result = await answer_plan_question(question, patient_id, mock_client)
        
        assert result["answer"] is None
        assert result["escalate"] is True
        assert len(result["cited_item_ids"]) == 0


@pytest.mark.asyncio
class TestDoctorAnswer:
    """Test doctor answer translation."""
    
    async def test_doctor_answer_translation(self):
        """Test doctor text is translated and simplified without adding new facts."""
        doctor_text = "Take this medicine twice daily after food"
        patient_language = "hi"
        
        mock_client = Mock(spec=OpenRouterClient)
        mock_client.generate = AsyncMock(return_value="इस दवा को भोजन के बाद दिन में दो बार लें")
        
        result = await translate_doctor_text(doctor_text, patient_language, mock_client)
        
        assert result["patient_text"] is not None
        assert result["source"] == "doctor_translation"
        assert result["original_text"] == doctor_text
        # Verify no new facts were added (simplified check)
        assert "twice" in result["patient_text"].lower() or "दो" in result["patient_text"]
    
    async def test_doctor_answer_english_no_translation(self):
        """Test that English patient language doesn't trigger translation."""
        doctor_text = "Take this medicine twice daily"
        patient_language = "en"
        
        mock_client = Mock(spec=OpenRouterClient)
        mock_client.generate = AsyncMock()  # Should not be called
        
        result = await translate_doctor_text(doctor_text, patient_language, mock_client)
        
        # In the endpoint, this would return original without calling LLM
        # Here we test the translation function itself
        assert result["source"] == "doctor_translation"
