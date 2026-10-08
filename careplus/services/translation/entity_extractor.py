import re
from typing import List, Tuple, Optional
from careplus.db.client import get_supabase_client
from careplus.core.logging import logger


# Synthetic drug dictionary for matching medication names
SYNTHETIC_DRUG_DICT = {
    "aspirin", "paracetamol", "ibuprofen", "metformin", "insulin",
    "lisinopril", "atorvastatin", "amlodipine", "omeprazole", "clopidogrel",
    "amlodipine", "metoprolol", "losartan", "pantoprazole", "ciprofloxacin",
    "azithromycin", "amoxicillin", "doxycycline", "prednisone", "warfarin",
    "digoxin", "furosemide", "hydrochlorothiazide", "glipizide", "sitagliptin"
}


async def fetch_approved_medications() -> set:
    r"""
    Fetch medication names from approved_item table where item_type is 'medication'.
    Returns a set of medication names for matching.
    """
    try:
        supabase = get_supabase_client(use_service_role=True)
        result = supabase.table("approved_item").select("content").eq("item_type", "medication").execute()
        
        medications = set()
        for item in result.data:
            content = item.get("content", "").lower()
            # Extract the medication name from content (simplified - assumes first word is name)
            words = content.split()
            if words:
                medications.add(words[0].lower())
        
        logger.info("fetched_approved_medications", count=len(medications))
        return medications
    except Exception as e:
        logger.error("fetch_medications_error", error=str(e))
        return set()


def extract_entities(text: str, approved_medications: Optional[set] = None) -> List[Tuple[str, str, Tuple[int, int]]]:
    r"""
    Extract entities from source text.
    
    Returns a list of (entity_type, value, span) tuples where span is (start, end).
    
    Entity types:
    - drug: medication names (matched against approved_item medication list + synthetic dictionary)
    - dose: dosages (regex \d+\s*(mg|ml|mcg|units))
    - frequency: frequencies (BID, TID, QID, daily, twice, times)
    - duration: durations (X days/weeks/months)
    - date: dates in any format
    - phone: phone numbers
    - abha_id: ABHA IDs
    - address: addresses
    """
    if approved_medications is None:
        approved_medications = SYNTHETIC_DRUG_DICT
    
    entities = []
    text_lower = text.lower()
    
    # Extract drug names
    for drug in approved_medications:
        # Match whole word or word boundary
        pattern = r'\b' + re.escape(drug) + r'\b'
        for match in re.finditer(pattern, text_lower):
            entities.append(("drug", drug, match.span()))
    
    # Extract doses: \d+\s*(mg|ml|mcg|units)
    dose_pattern = r'\d+\s*(?:mg|ml|mcg|units)\b'
    for match in re.finditer(dose_pattern, text_lower):
        entities.append(("dose", match.group(), match.span()))
    
    # Extract frequencies: BID, TID, QID, daily, twice, times
    frequency_keywords = ["bid", "tid", "qid", "daily", "twice", "times", "once", "weekly", "monthly"]
    for freq in frequency_keywords:
        pattern = r'\b' + re.escape(freq) + r'\b'
        for match in re.finditer(pattern, text_lower):
            entities.append(("frequency", freq, match.span()))
    
    # Extract durations: X days/weeks/months
    duration_pattern = r'\d+\s*(?:days?|weeks?|months?)\b'
    for match in re.finditer(duration_pattern, text_lower):
        entities.append(("duration", match.group(), match.span()))
    
    # Extract dates: various formats
    # DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD Mon YYYY, etc.
    date_patterns = [
        r'\b\d{1,2}/\d{1,2}/\d{4}\b',  # DD/MM/YYYY or MM/DD/YYYY
        r'\b\d{4}-\d{2}-\d{2}\b',  # YYYY-MM-DD
        r'\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b',  # DD Mon YYYY
    ]
    for pattern in date_patterns:
        for match in re.finditer(pattern, text_lower):
            entities.append(("date", match.group(), match.span()))
    
    # Extract phone numbers: Indian format (+91 XXXXX XXXXX) or general
    phone_pattern = r'(?:\+91\s?)?\d{5}\s?\d{5}\b|\d{10}\b'
    for match in re.finditer(phone_pattern, text):
        entities.append(("phone", match.group(), match.span()))
    
    # Extract ABHA IDs: pattern like ABHA-XXXX-XXXX-XXXX or similar
    abha_pattern = r'\b(?:ABHA\s*[-:\s]?)?\d{4}[-:\s]?\d{4}[-:\s]?\d{4}\b'
    for match in re.finditer(abha_pattern, text, re.IGNORECASE):
        entities.append(("abha_id", match.group(), match.span()))
    
    # Extract addresses: simplified pattern - sentences with street/road/area/city keywords
    address_keywords = ["street", "road", "area", "city", "town", "village", "lane", "nagar", "colony"]
    for keyword in address_keywords:
        pattern = r'\b' + re.escape(keyword) + r'\b[^.]*'
        for match in re.finditer(pattern, text_lower):
            # Include surrounding context (up to 50 chars before and after)
            start = max(0, match.start() - 30)
            end = min(len(text), match.end() + 30)
            address_text = text[start:end].strip()
            entities.append(("address", address_text, (start, end)))
    
    # Sort entities by start position
    entities.sort(key=lambda x: x[2][0])
    
    logger.info("entities_extracted", count=len(entities), text_length=len(text))
    return entities
