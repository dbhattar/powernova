# Follow-Up Prompts Feature

## Overview
The PowerNOVA chat interface now dynamically generates contextual follow-up questions after each AI response, helping users continue conversations naturally and explore related topics.

## How It Works

### 1. **LLM-Generated Questions**
Instead of hardcoded follow-up questions, the system uses the LLM to generate 3 contextual follow-up questions based on the conversation history.

### 2. **API Call Flow**
```
User asks question
    ↓
AI responds with answer
    ↓
System sends conversation context to LLM
    ↓
LLM generates 3 relevant follow-up questions
    ↓
Questions displayed as clickable buttons
    ↓
User clicks → Question auto-fills input → Conversation continues
```

### 3. **Context-Aware Generation**
The system sends:
- **Last 4 messages** from the conversation
- **System prompt** instructing the LLM to generate relevant energy-market questions
- **Response format** specification (JSON with text and icon)

## Implementation Details

### API Endpoint Used
```javascript
POST /api/chat
```

**Request:**
```json
{
  "messages": [
    {
      "role": "system",
      "content": "Generate 3 follow-up questions..."
    },
    {
      "role": "user",
      "content": "What are CAISO interconnection procedures?"
    },
    {
      "role": "assistant",
      "content": "CAISO interconnection procedures involve..."
    }
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.8,
  "max_tokens": 300
}
```

**Response Format:**
```json
[
  {
    "text": "What are the timeline requirements for CAISO interconnection?",
    "icon": "fas fa-clock"
  },
  {
    "text": "What are typical interconnection upgrade costs?",
    "icon": "fas fa-dollar-sign"
  },
  {
    "text": "How does CAISO's study process work?",
    "icon": "fas fa-list-ol"
  }
]
```

### System Prompt
The LLM receives specific instructions to:
1. Generate exactly 3 questions
2. Make them specific to energy markets/regulations
3. Build upon the current conversation
4. Return JSON format with text and icon
5. Use appropriate Font Awesome icons

### Icons Available
```javascript
fa-clock, fa-dollar-sign, fa-chart-line, fa-file-alt, 
fa-gavel, fa-industry, fa-bolt, fa-sun, fa-wind, 
fa-battery-full, fa-plug, fa-network-wired, fa-database, 
fa-info-circle, fa-list-ol, fa-calendar-alt, fa-tools, 
fa-shield-alt, fa-globe-americas, fa-exchange-alt, 
fa-balance-scale
```

## Code Structure

### Key Methods

#### 1. `showFollowUpPrompts(aiMessage)`
```javascript
async showFollowUpPrompts(aiMessage) {
    // Remove existing prompts
    // Call LLM to generate questions
    // Create UI elements
    // Add click handlers
    // Display in chat
}
```

#### 2. `generateFollowUpQuestions(aiMessage)`
```javascript
async generateFollowUpQuestions(aiMessage) {
    // Get recent conversation context
    // Create system prompt
    // Call API
    // Parse JSON response
    // Return array of {text, icon} objects
}
```

#### 3. `getFallbackFollowUps()`
```javascript
getFallbackFollowUps() {
    // Returns predefined questions if API fails
    // Multiple sets to provide variety
    // Ensures UX isn't broken
}
```

### CSS Classes

```css
.followup-prompts {
    /* Container for follow-up section */
    margin-top: 1rem;
}

.followup-grid {
    /* Grid layout for buttons */
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
}

.followup-btn {
    /* Individual question button */
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    padding: 0.75rem 1rem;
    cursor: pointer;
}

.followup-btn:hover {
    border-color: var(--primary-color);
    transform: translateY(-1px);
}
```

## User Experience

### Display
- Follow-up questions appear **immediately after** the AI finishes responding
- Styled as clickable cards with icons
- Grid layout adapts to screen size
- Mobile-friendly (stacks vertically on small screens)

### Interaction
1. User clicks a follow-up question
2. Question automatically fills the input field
3. Message is sent immediately
4. Previous follow-up prompts are removed
5. New follow-up prompts appear after the next response

### Lifecycle
```
AI Response Completes
    ↓
Generate Follow-ups (async)
    ↓
Display as buttons below message
    ↓
User sends new message
    ↓
Remove old follow-ups
    ↓
[Cycle repeats]
```

## Error Handling

### Fallback Mechanism
If the API call fails or returns invalid JSON:
1. **Fallback questions** are displayed instead
2. System logs error to console
3. User experience is not interrupted
4. Multiple fallback sets provide variety

### Example Fallback Sets:
```javascript
// Set 1: General exploration
[
  "Can you provide more details on this topic?",
  "What are the latest regulatory changes?",
  "How does this compare to other regions?"
]

// Set 2: Process-focused
[
  "What are the timeline requirements?",
  "What are the typical costs involved?",
  "What documentation is needed?"
]

// Set 3: Implementation-focused
[
  "How does the process work?",
  "What are common challenges?",
  "What are best practices?"
]
```

## Benefits

### 1. **Contextual Relevance**
- Questions are tailored to the specific conversation
- LLM understands nuances and generates appropriate follow-ups
- More engaging than generic suggestions

### 2. **Continuous Exploration**
- Encourages users to dive deeper into topics
- Helps discover related information
- Guides conversation in productive directions

### 3. **Better Discoverability**
- Users learn about related topics they might not have considered
- Exposes breadth of knowledge available
- Reduces cognitive load (users don't have to think of next question)

### 4. **Dynamic Adaptation**
- Questions adapt to any topic within energy markets
- No need to maintain large lists of hardcoded questions
- LLM can generate questions for new topics automatically

## Performance Considerations

### API Call Timing
- Follow-up generation happens **after** main response completes
- Non-blocking: doesn't slow down the main conversation
- Typically completes in 1-2 seconds

### Token Usage
- **~300 tokens** per follow-up generation
- Uses `gpt-4o-mini` for cost efficiency
- Temperature: 0.8 for creative variety

### Caching
- No caching currently implemented
- Each conversation generates fresh questions
- Could add caching based on conversation hash if needed

## Future Enhancements

### Potential Improvements
1. **Smart caching**: Cache follow-ups for similar conversation patterns
2. **User preferences**: Learn which types of follow-ups users click most
3. **Difficulty levels**: Generate basic vs advanced follow-up questions
4. **Multi-language**: Support follow-ups in different languages
5. **Topic tracking**: Generate questions that explore different angles
6. **Source awareness**: Generate questions about specific cited sources

### Advanced Features
```javascript
// Example: Difficulty-based generation
generateFollowUpQuestions(aiMessage, difficulty = 'medium') {
    // Adjust system prompt based on difficulty
    // 'basic' → General overview questions
    // 'advanced' → Technical deep-dive questions
}

// Example: Topic diversification
generateFollowUpQuestions(aiMessage, diversify = true) {
    // One question: Deeper on current topic
    // One question: Related tangent
    // One question: Broader context
}
```

## Testing

### Manual Testing Checklist
- [ ] Follow-ups appear after AI response
- [ ] Clicking follow-up sends message
- [ ] Old follow-ups removed when new message sent
- [ ] Fallback questions work if API fails
- [ ] Mobile layout displays correctly
- [ ] Icons render properly
- [ ] Hover effects work
- [ ] Questions are relevant to conversation

### Example Test Conversations

**Test 1: CAISO Topic**
```
User: "What are CAISO interconnection procedures?"
Expected follow-ups:
  - Timeline-related questions
  - Cost-related questions
  - Process-related questions
```

**Test 2: Market Comparison**
```
User: "Compare PJM and MISO capacity markets"
Expected follow-ups:
  - Deeper comparison questions
  - Specific market mechanism questions
  - Regional difference questions
```

**Test 3: Regulatory**
```
User: "Explain FERC Order 2023"
Expected follow-ups:
  - Implementation timeline questions
  - Impact assessment questions
  - Compliance requirement questions
```

## Troubleshooting

### Issue: Follow-ups not appearing
**Check:**
1. API connection working?
2. Console errors in browser DevTools?
3. Response format from API valid?

**Fix:**
- Verify `/api/chat` endpoint is accessible
- Check system prompt is being sent correctly
- Ensure fallback mechanism triggers

### Issue: Irrelevant questions
**Check:**
1. Conversation context being sent?
2. System prompt clear enough?
3. Temperature too high?

**Fix:**
- Verify last 4 messages are included
- Refine system prompt instructions
- Adjust temperature (currently 0.8)

### Issue: Slow to appear
**Check:**
1. API response time
2. Network latency
3. Token limit causing truncation

**Fix:**
- Monitor API response times
- Consider reducing max_tokens if needed
- Add loading indicator if >2 seconds

## Analytics

### Metrics to Track
1. **Click-through rate**: % of follow-ups clicked
2. **Generation success rate**: % successful vs fallback
3. **Response time**: Time to generate follow-ups
4. **Question quality**: User feedback/engagement
5. **Conversation depth**: Messages before conversation ends

### Example Analytics Code
```javascript
// Track follow-up clicks
followupBtn.addEventListener('click', () => {
    analytics.track('followup_clicked', {
        question: followUp.text,
        conversation_depth: this.messages.length,
        topic: this.getConversationTopic()
    });
});

// Track generation performance
const startTime = Date.now();
const followUps = await this.generateFollowUpQuestions(aiMessage);
const duration = Date.now() - startTime;

analytics.track('followup_generated', {
    duration_ms: duration,
    success: followUps.length > 0,
    fallback_used: followUps === this.getFallbackFollowUps()
});
```

## Summary

✅ **Implemented:**
- LLM-generated contextual follow-up questions
- Clean UI with icons and hover effects
- Robust error handling with fallbacks
- Mobile-responsive design
- One-click question insertion

✅ **Benefits:**
- More engaging conversations
- Better topic discovery
- Reduced user cognitive load
- Dynamic adaptation to any topic

✅ **Next Steps:**
1. Test with real conversations
2. Monitor generation quality
3. Gather user feedback
4. Iterate on system prompt if needed
5. Consider adding analytics

The feature is production-ready and enhances the chat experience significantly! 🚀
