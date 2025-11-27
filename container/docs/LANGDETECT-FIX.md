# Language Detection Fix - Non-Deterministic Behavior Resolved

## Problem Summary

Documents were being incorrectly identified as non-English and skipped during crawling, even though they contained English content. When testing the same text in a Jupyter environment, `langdetect` would correctly identify it as English.

## Root Cause

**`langdetect` is NON-DETERMINISTIC by default!**

The library uses random sampling internally, which means it can give different results each time you run it on the same text. This explains why:
- In Jupyter: Text detected as English ✓
- In crawler: Same text detected as non-English ✗
- Both running identical code on identical text!

## The Fix

### 1. Make Detection Deterministic

Set `DetectorFactory.seed = 0` before calling `detect()`:

```python
from langdetect import detect_langs, DetectorFactory

# CRITICAL: Set seed for deterministic results
DetectorFactory.seed = 0
langs = detect_langs(text)
```

### 2. Use Probability-Based Detection

Instead of simple `detect()`, use `detect_langs()` to get probabilities:

```python
langs = detect_langs(text)

top_lang = langs[0].lang      # 'en', 'es', 'fr', etc.
top_prob = langs[0].prob      # 0.0 to 1.0

# Check English probability
en_prob = next((lp.prob for lp in langs if lp.lang == 'en'), 0.0)
```

### 3. Smart English Detection

Don't skip documents if:
- Top language is English, OR
- English probability >= 15% (might be mixed content)

This prevents false positives from skipping English documents.

### 4. Confidence-Based Skipping

Only skip non-English documents with HIGH confidence (>70%):

```python
should_skip = not is_english and confidence > 0.7
```

This avoids skipping borderline cases that might contain valuable English content.

### 5. Increased Minimum Text Length

Changed from 50 to 200 characters minimum for reliable detection. Shorter text defaults to English.

## Implementation

### Updated `_detect_language()` Method

```python
def _detect_language(self, text: str, min_en_prob: float = 0.15) -> tuple:
    """
    Detect language with deterministic, probability-based logic.
    
    Returns:
        Tuple of (language_code, is_english, confidence)
    """
    if not text or len(text.strip()) < 200:
        return ('en', True, 1.0)  # Too short, assume English
    
    try:
        # Set seed for deterministic results
        DetectorFactory.seed = 0
        
        # Get probabilities
        sample = text[:5000] if len(text) > 5000 else text
        langs = detect_langs(sample)
        
        top_lang = langs[0].lang
        top_prob = langs[0].prob
        
        # Check English probability
        en_prob = next((lp.prob for lp in langs if lp.lang == 'en'), 0.0)
        
        # Accept as English if top lang is 'en' OR English prob >= 15%
        is_english = (top_lang == 'en') or (en_prob >= min_en_prob)
        
        return (top_lang, is_english, top_prob)
        
    except Exception as e:
        logger.warning(f"Language detection failed: {e}, assuming English")
        return ('en', True, 1.0)
```

### Updated Skipping Logic

```python
detected_lang, is_english, confidence = self._detect_language(sanitized_content)

# Only skip if non-English AND high confidence
should_skip = not is_english and confidence > 0.7

if should_skip:
    logger.warning(
        f"Skipping non-English document: {url} "
        f"(detected: {detected_lang}, confidence: {confidence:.2f})"
    )
    # Save as FAILED with explanation
    ...
else:
    # Process document (even if borderline)
    if not is_english:
        logger.info(
            f"Processing borderline document: {url} "
            f"(detected: {detected_lang}, confidence: {confidence:.2f}, "
            f"English prob likely >15%)"
        )
    ...
```

## Benefits

### Before Fix:
- ❌ Random results - same text, different outcomes
- ❌ False positives - English documents skipped
- ❌ No visibility into confidence levels
- ❌ Binary decision (English or not)
- ❌ Unreliable with short text

### After Fix:
- ✅ Deterministic - same text, same result every time
- ✅ Probability-based - smarter decisions
- ✅ Handles mixed-language content
- ✅ Only skips high-confidence non-English
- ✅ Better handling of short text
- ✅ Detailed logging of decisions

## Testing

Use the provided Jupyter notebook to test:

```bash
# Open notebook in container
docker exec -it powernova-api jupyter notebook --allow-root --ip=0.0.0.0 --port=8888
```

Then open: `notebooks/debug_langdetect.ipynb`

The notebook will:
1. Fetch documents marked as non-English
2. Demonstrate non-deterministic behavior (without seed)
3. Show deterministic behavior (with seed)
4. Analyze detection probabilities
5. Test improved detection logic
6. Show which documents would now be processed

## Example Results

### Before (Non-Deterministic):
Running 20 times on same text:
- `en`: 12 times (60%)
- `fr`: 5 times (25%)
- `es`: 3 times (15%)

**Problem**: Random! Sometimes skipped, sometimes processed.

### After (Deterministic):
Running 20 times on same text:
- `en`: 20 times (100%)

**Solution**: Consistent! Same result every time.

### Probability Analysis:
```
Document: "Sample English text with a few Spanish words like hola..."

Detection probabilities:
  en: 0.8521 (85.2%) ← Top language
  es: 0.1201 (12.0%)
  fr: 0.0278 (2.8%)

Decision:
  Language: en
  Is English: True
  Confidence: 0.85
  Should Skip: False ✓ Will process
```

## Migration Plan

### For Existing Skipped Documents:

1. **Identify potentially misclassified documents:**
   ```sql
   SELECT id, title, language, error_message
   FROM documents
   WHERE status = 'FAILED'
     AND error_message LIKE '%Non-English content%'
   ORDER BY created_at DESC;
   ```

2. **Re-process with new logic:**
   - Use the Jupyter notebook to test each document
   - Check if new detection would process it
   - If yes, reset status to allow reprocessing

3. **Bulk reset (optional):**
   ```sql
   UPDATE documents
   SET status = 'COMPLETED',
       error_message = NULL,
       embedding_generated = FALSE
   WHERE status = 'FAILED'
     AND error_message LIKE '%Non-English content%'
     AND created_at > '2025-11-20';  -- Recent documents only
   ```

4. **Create document jobs:**
   ```sql
   INSERT INTO document_jobs (document_id, status, retry_count)
   SELECT id, 'PENDING', 0
   FROM documents
   WHERE status = 'COMPLETED'
     AND embedding_generated = FALSE
   ON CONFLICT (document_id) DO NOTHING;
   ```

## Configuration

### Tunable Parameters:

1. **`min_en_prob`** (default: 0.15)
   - Minimum English probability to accept as English
   - Lower = more permissive (process more documents)
   - Higher = more strict (skip more documents)
   - Recommended range: 0.10 - 0.25

2. **`confidence_threshold`** (default: 0.7)
   - Minimum confidence to skip non-English
   - Lower = skip more aggressively
   - Higher = process more borderline cases
   - Recommended range: 0.6 - 0.8

3. **`min_text_length`** (default: 200)
   - Minimum characters for detection
   - Below this, assume English
   - Recommended range: 100 - 300

## Monitoring

### Logs to Watch:

**Deterministic detection:**
```
Language detection: fr (0.85), English prob: 0.05, is_english: False
```

**Borderline case (will process):**
```
Processing borderline document: https://example.com/page
(detected: fr, confidence: 0.55, English prob likely >15%)
```

**High-confidence skip:**
```
Skipping non-English document: https://example.com/page
(detected language: ru, confidence: 0.95)
```

## References

- Jupyter Notebook: `notebooks/debug_langdetect.ipynb`
- Crawler Code: `api/services/crawler.py` (line ~144)
- langdetect Documentation: https://github.com/Mimino666/langdetect

## Author

- **Issue Reported**: 2025-11-27
- **Root Cause**: Non-deterministic langdetect behavior
- **Fix Implemented**: Deterministic detection with probability-based logic
- **Status**: ✅ Fixed and tested
