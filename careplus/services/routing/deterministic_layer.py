from typing import Dict, Any, List
from careplus.core.logging import logger


# Keyword lists for deterministic routing (English + Hindi + Tamil)
EMERGENCY_KEYWORDS = {
    "en": [
        "chest pain", "can't breathe", "cannot breathe", "severe bleeding",
        "fainting", "fainted", "stroke", "stroke symptoms", "suicidal",
        "suicide", "kill myself", "heart attack", "emergency", "dying"
    ],
    "hi": [
        "छाती दर्द", "सांस नहीं ले पा रहा", "सांस नहीं", "खून बह रहा",
        "बेहोश", "लकवा", "स्ट्रोक", "आत्महत्या", "खुदकुशी", "दिल का दौरा",
        "आपातकाल"
    ],
    "ta": [
        "மார்பு வலி", "மூச்சு விட முடியவில்லை", "மூச்சு பிடிக்க",
        "கடுமையான இரத்தப்போக்கு", "மயக்கம்", "பக்கவாதம்", "ஸ்ட்ரோக்",
        "தற்கொலை", "இதய தாக்கம்", "அவசரம்"
    ]
}

MEDICINE_KEYWORDS = {
    "en": [
        "medication", "medicine", "dose", "pill", "side effect", "prescription",
        "drug", "tablet", "capsule", "injection", "take medicine", "medicines"
    ],
    "hi": [
        "दवा", "खुराक", "गोली", "दवाई", "साइड इफेक्ट", "प्रिस्क्रिप्शन",
        "इंजेक्शन", "टैबलेट"
    ],
    "ta": [
        "மருந்து", "அளவு", "மாத்திரை", "மருந்தை", "பக்க விளைவு",
        "மருந்து சீட்டு", "ஊசி", "�மாத்திரை"
    ]
}

SYMPTOM_KEYWORDS = {
    "en": [
        "pain", "fever", "swelling", "nausea", "dizziness", "bleeding",
        "headache", "vomiting", "cough", "cold", "weakness", "tired",
        "symptom", "problem", "issue"
    ],
    "hi": [
        "दर्द", "बुखार", "सूजन", "उल्टी", "चक्कर", "खून बहना",
        "सिरदर्द", "खांसी", "जुकाम", "कमजोरी", "थकान", "लक्षण"
    ],
    "ta": [
        "வலி", "காய்ச்சல்", "வீக்கம்", "வாந்தி", "தலைச்சுற்று", "இரத்தப்போக்கு",
        "தலைவலி", "இருமல்", "சளி", "வலுவிழப்பு", "அரிப்பு", "அறிகுறி"
    ]
}


def deterministic_route(question: str, language: str = "en") -> Dict[str, Any]:
    """
    Run deterministic routing BEFORE LLM classifier.
    
    Checks for keyword matches in the question. If any emergency keyword matches,
    returns emergency route immediately with no LLM call.
    
    Returns:
        Dict with:
        - route: 'emergency', 'medicine', 'symptom', or None (no match)
        - escalate: boolean
        - warning_signs: list of matched emergency keywords (if emergency)
        - matched_keywords: list of all matched keywords
    """
    question_lower = question.lower()
    matched_keywords = []
    
    # Check emergency keywords first (highest priority)
    emergency_matches = []
    for lang in ["en", "hi", "ta"]:  # Check all languages
        for keyword in EMERGENCY_KEYWORDS[lang]:
            if keyword in question_lower:
                emergency_matches.append(keyword)
                matched_keywords.append(keyword)
    
    if emergency_matches:
        logger.warning(
            "emergency_keyword_detected",
            question=question[:100],
            matches=emergency_matches
        )
        return {
            "route": "emergency",
            "escalate": True,
            "warning_signs": emergency_matches,
            "matched_keywords": matched_keywords
        }
    
    # Check medicine keywords
    medicine_matches = []
    for lang in ["en", "hi", "ta"]:
        for keyword in MEDICINE_KEYWORDS[lang]:
            if keyword in question_lower:
                medicine_matches.append(keyword)
                matched_keywords.append(keyword)
    
    if medicine_matches:
        logger.info(
            "medicine_keyword_detected",
            question=question[:100],
            matches=medicine_matches
        )
        return {
            "route": "medicine",
            "escalate": True,
            "warning_signs": [],
            "matched_keywords": matched_keywords
        }
    
    # Check symptom keywords
    symptom_matches = []
    for lang in ["en", "hi", "ta"]:
        for keyword in SYMPTOM_KEYWORDS[lang]:
            if keyword in question_lower:
                symptom_matches.append(keyword)
                matched_keywords.append(keyword)
    
    if symptom_matches:
        logger.info(
            "symptom_keyword_detected",
            question=question[:100],
            matches=symptom_matches
        )
        return {
            "route": "symptom",
            "escalate": True,
            "warning_signs": [],
            "matched_keywords": matched_keywords
        }
    
    # No keyword match - pass to LLM classifier
    logger.info("no_keyword_match", question=question[:100])
    return {
        "route": None,
        "escalate": False,
        "warning_signs": [],
        "matched_keywords": []
    }
