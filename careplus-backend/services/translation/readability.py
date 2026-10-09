import re
from typing import Dict, Any
from careplus.core.logging import logger


def check_readability(text: str) -> Dict[str, Any]:
    """
    Check readability of translated text using Flesch-Kincaid grade level
    and average sentence length.
    
    Acentra/CMS standard:
    - Grade level ≤ 9
    - Average sentence length < 20 words
    
    Args:
        text: The text to check
    
    Returns:
        Dict with:
        - grade_level: Flesch-Kincaid grade level
        - avg_sentence_length: Average sentence length in words
        - passed: Boolean indicating if readability check passed
        - flags: List of flags (e.g., ['translation_failed'])
    """
    flags = []
    
    # Calculate Flesch-Kincaid grade level
    grade_level = calculate_flesch_kincaid_grade(text)
    
    # Calculate average sentence length
    avg_sentence_length = calculate_avg_sentence_length(text)
    
    # Check against standards
    grade_passed = grade_level <= 9
    sentence_passed = avg_sentence_length < 20
    
    passed = grade_passed and sentence_passed
    
    if not grade_passed:
        flags.append("grade_level_too_high")
        logger.warning(
            "readability_grade_failed",
            grade_level=grade_level,
            threshold=9
        )
    
    if not sentence_passed:
        flags.append("sentence_too_long")
        logger.warning(
            "readability_sentence_failed",
            avg_length=avg_sentence_length,
            threshold=20
        )
    
    if not passed:
        flags.append("translation_failed")
        logger.warning(
            "readability_check_failed",
            grade_level=grade_level,
            avg_sentence_length=avg_sentence_length
        )
    else:
        logger.info(
            "readability_check_passed",
            grade_level=grade_level,
            avg_sentence_length=avg_sentence_length
        )
    
    return {
        "grade_level": round(grade_level, 2),
        "avg_sentence_length": round(avg_sentence_length, 2),
        "passed": passed,
        "flags": flags
    }


def calculate_flesch_kincaid_grade(text: str) -> float:
    """
    Calculate Flesch-Kincaid grade level.
    
    Formula: 0.39 * (total_words / total_sentences) + 11.8 * (total_syllables / total_words) - 15.59
    
    Returns:
        Grade level as a float
    """
    if not text or not text.strip():
        return 0.0
    
    sentences = count_sentences(text)
    words = count_words(text)
    syllables = count_syllables(text)
    
    if sentences == 0 or words == 0:
        return 0.0
    
    grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
    return max(0, grade)  # Grade level can't be negative


def calculate_avg_sentence_length(text: str) -> float:
    """
    Calculate average sentence length in words.
    
    Returns:
        Average sentence length as a float
    """
    if not text or not text.strip():
        return 0.0
    
    sentences = count_sentences(text)
    words = count_words(text)
    
    if sentences == 0:
        return 0.0
    
    return words / sentences


def count_sentences(text: str) -> int:
    """
    Count the number of sentences in text.
    
    Splits on sentence boundaries: . ! ? and handles abbreviations.
    """
    # Common abbreviations that shouldn't end sentences
    abbreviations = ["mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "eg", "ie", "approx", "avg"]
    
    # Replace abbreviations with markers to avoid false splits
    for abbr in abbreviations:
        text = re.sub(r'\b' + abbr + r'\.', abbr + '<DOT>', text, flags=re.IGNORECASE)
    
    # Split on sentence boundaries
    sentences = re.split(r'[.!?]+', text)
    
    # Filter empty sentences
    sentences = [s.strip() for s in sentences if s.strip()]
    
    return len(sentences)


def count_words(text: str) -> int:
    """
    Count the number of words in text.
    """
    words = re.findall(r'\b\w+\b', text)
    return len(words)


def count_syllables(text: str) -> int:
    """
    Count the number of syllables in text.
    
    This is a simplified approximation that works reasonably well for English.
    For other languages, this would need language-specific rules.
    """
    words = re.findall(r'\b\w+\b', text.lower())
    total_syllables = 0
    
    for word in words:
        total_syllables += count_word_syllables(word)
    
    return total_syllables


def count_word_syllables(word: str) -> int:
    """
    Count syllables in a single word using simplified rules.
    
    Approximation: count vowel groups, with adjustments for silent e, etc.
    """
    if not word:
        return 0
    
    word = word.lower()
    
    # Remove non-alphabetic characters
    word = re.sub(r'[^a-z]', '', word)
    
    if len(word) <= 3:
        return 1  # Most short words have 1 syllable
    
    # Count vowel groups
    vowels = "aeiouy"
    syllable_count = 0
    prev_char_was_vowel = False
    
    for char in word:
        is_vowel = char in vowels
        
        if is_vowel and not prev_char_was_vowel:
            syllable_count += 1
        
        prev_char_was_vowel = is_vowel
    
    # Adjustments
    # Silent e at the end
    if word.endswith('e'):
        syllable_count -= 1
    
    # Ensure at least 1 syllable
    syllable_count = max(1, syllable_count)
    
    return syllable_count
