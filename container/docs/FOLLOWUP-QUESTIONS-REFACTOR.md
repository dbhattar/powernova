# Follow-Up Questions Feature Refactor

**Date**: November 20, 2025  
**Status**: ✅ Completed

## Overview

Moved the follow-up questions generation logic from the frontend to the backend by creating a dedicated API endpoint. This provides better separation of concerns, easier prompt management, and improved maintainability.

## Changes Made

### 1. Backend: New API Endpoint

**File**: `api/routes/chat.py`

**New Endpoint**: `POST /api/chat/follow-up-questions`

**Request Model**:
```python
{
  "messages": [
    {"role": "user", "content": "What is CAISO?"},
    {"role": "assistant", "content": "CAISO is..."}
  ],
  "count": 3  // Optional, default 3, max 5
}
```

**Response Model**:
```python
{
  "questions": [
    {"text": "What are the timeline requirements?", "icon": "fas fa-clock"},
    {"text": "How do costs compare across regions?", "icon": "fas fa-dollar-sign"},
    {"text": "What are the next steps?", "icon": "fas fa-list-ol"}
  ]
}
```

**Features**:
- ✅ Dedicated system prompt for generating energy market follow-up questions
- ✅ Configurable question count (1-5)
- ✅ Automatic JSON parsing with error handling
- ✅ Fallback questions if generation fails
- ✅ Proper validation of response structure
- ✅ Font Awesome icon suggestions

**System Prompt** (now in backend):
```
You are a helpful assistant that generates relevant follow-up questions 
for conversations about energy markets, regulations, and grid operations.

Based on the conversation context, generate exactly {count} relevant 
follow-up questions that the user might want to ask next. The questions should:
1. Be specific and actionable
2. Build upon the current conversation
3. Explore related topics or dive deeper into mentioned concepts
4. Be relevant to energy markets, CAISO, ERCOT, PJM, MISO, FERC regulations, 
   or grid operations

Return ONLY a JSON array with exactly {count} objects, each with "text" 
and "icon" properties. Use Font Awesome icon classes.
```

### 2. Frontend: Simplified Implementation

**File**: `app/js/app.js`

**Before** (70+ lines):
- Embedded system prompt in JavaScript
- Manual JSON parsing logic
- Complex error handling

**After** (40 lines):
- Simple API call to dedicated endpoint
- Clean response handling
- Maintained fallback behavior

**Key Changes**:
```javascript
// Before: Complex system prompt construction
const systemPrompt = `You are a helpful assistant...` // 30+ lines

const response = await fetch(`${apiUrl}/api/chat`, {
  body: JSON.stringify({
    messages: [{ role: 'system', content: systemPrompt }, ...recentMessages],
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 300
  })
});

// After: Simple dedicated endpoint call
const response = await fetch(`${apiUrl}/api/chat/follow-up-questions`, {
  body: JSON.stringify({
    messages: recentMessages,
    count: 3
  })
});
```

## Benefits

### 1. **Separation of Concerns**
- ✅ Prompt engineering stays in backend
- ✅ Frontend only handles UI logic
- ✅ Easier to test and debug

### 2. **Maintainability**
- ✅ Update prompts without frontend deployment
- ✅ Centralized prompt management
- ✅ Version control for prompt changes

### 3. **Security**
- ✅ API key never exposed to frontend
- ✅ Better control over LLM parameters
- ✅ Rate limiting can be applied at endpoint level

### 4. **Consistency**
- ✅ Same prompt logic used everywhere
- ✅ Standardized response format
- ✅ Uniform error handling

### 5. **Performance**
- ✅ Smaller frontend bundle (removed 30+ lines of prompt text)
- ✅ Better caching opportunities
- ✅ Reduced client-side processing

## Testing

### Manual Testing Steps:

1. **Start a chat conversation**:
   ```
   User: "What are the CAISO interconnection procedures?"
   ```

2. **Verify follow-up questions appear**:
   - Should see 3 relevant questions
   - Each should have an icon
   - Questions should be contextual

3. **Test error handling**:
   - Disconnect from API
   - Verify fallback questions appear

4. **Test API directly**:
   ```bash
   curl -X POST http://localhost:8000/api/chat/follow-up-questions \
     -H "Content-Type: application/json" \
     -d '{
       "messages": [
         {"role": "user", "content": "What is CAISO?"},
         {"role": "assistant", "content": "CAISO is the California Independent System Operator..."}
       ],
       "count": 3
     }'
   ```

### Expected Response:
```json
{
  "questions": [
    {
      "text": "What are the key CAISO market structures?",
      "icon": "fas fa-network-wired"
    },
    {
      "text": "How does CAISO handle renewable integration?",
      "icon": "fas fa-solar-panel"
    },
    {
      "text": "What are the latest CAISO tariff changes?",
      "icon": "fas fa-gavel"
    }
  ]
}
```

## API Documentation

The new endpoint is automatically documented in the FastAPI Swagger UI:
- **Local**: http://localhost:8000/docs
- **Production**: https://api.powernova.ai/docs

Look for: `POST /api/chat/follow-up-questions`

## Future Enhancements

Potential improvements:
1. Add user preferences for question types
2. Implement caching for common conversation patterns
3. A/B test different prompt variations
4. Add analytics for question click-through rates
5. Support for domain-specific question templates
6. Multi-language support

## Rollback Plan

If issues arise:
1. Revert `api/routes/chat.py` to remove the new endpoint
2. Revert `app/js/app.js` to use old system prompt logic
3. Rebuild and deploy containers

## Migration Notes

- ✅ No database changes required
- ✅ Backward compatible (frontend gracefully falls back on error)
- ✅ No breaking changes to existing APIs
- ✅ Can be deployed independently

## Files Modified

1. `api/routes/chat.py` - Added new endpoint and Pydantic models
2. `app/js/app.js` - Simplified follow-up question generation logic

## Related Documentation

- [API Quick Start](./API-QUICK-START.md)
- [Chat App Setup](./CHAT-APP-SETUP.md)
- [FastAPI Implementation Summary](./FASTAPI-IMPLEMENTATION-SUMMARY.md)
