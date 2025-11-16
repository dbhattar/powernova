// ==================== //
// PowerNOVA Chat App   //
// ==================== //

class ChatApp {
    constructor() {
        this.messages = [];
        this.currentChatId = null;
        this.isTyping = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.autoResizeTextarea();
    }
    
    initializeElements() {
        // Main elements
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.sidebar = document.getElementById('sidebar');
        
        // Buttons
        this.newChatBtn = document.getElementById('newChatBtn');
        this.historyBtn = document.getElementById('historyBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.attachBtn = document.getElementById('attachBtn');
        this.closeSidebar = document.getElementById('closeSidebar');
        
        // Example buttons
        this.exampleBtns = document.querySelectorAll('.example-btn');
    }
    
    attachEventListeners() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Input handling
        this.messageInput.addEventListener('input', () => {
            this.sendBtn.disabled = !this.messageInput.value.trim();
        });
        
        // Example questions
        this.exampleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.question;
                this.messageInput.value = question;
                this.sendBtn.disabled = false;
                this.sendMessage();
            });
        });
        
        // New chat
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        
        // History toggle
        this.historyBtn.addEventListener('click', () => {
            this.sidebar.classList.toggle('hidden');
        });
        
        // Settings
        this.settingsBtn.addEventListener('click', () => {
            alert('Settings feature coming soon!');
        });
        
        // Attach file
        this.attachBtn.addEventListener('click', () => {
            alert('File upload feature coming soon!');
        });
        
        // Close sidebar
        this.closeSidebar.addEventListener('click', () => {
            this.sidebar.classList.add('hidden');
        });
    }
    
    autoResizeTextarea() {
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
        });
    }
    
    sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || this.isTyping) return;
        
        // Hide welcome screen and show messages
        this.welcomeScreen.classList.add('hidden');
        this.messagesContainer.classList.add('active');
        
        // Remove any existing follow-up prompts
        const existingPrompts = this.messagesContainer.querySelectorAll('.followup-prompts');
        existingPrompts.forEach(el => el.remove());
        
        // Add user message
        this.addMessage('user', text);
        
        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.sendBtn.disabled = true;
        
        // Simulate AI response
        this.simulateAIResponse(text);
    }
    
    addMessage(role, content, sources = null) {
        const messageId = Date.now();
        const message = {
            id: messageId,
            role,
            content,
            sources,
            timestamp: new Date()
        };
        
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }
    
    renderMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.role}`;
        messageEl.dataset.id = message.id;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = message.role === 'user' 
            ? '<i class="fas fa-user"></i>' 
            : '<i class="fas fa-robot"></i>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        // Render markdown for assistant messages, plain text for user messages
        if (message.role === 'assistant') {
            // Configure marked for better rendering
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
            
            // Render markdown
            bubble.innerHTML = marked.parse(message.content || '');
            
            // Apply syntax highlighting to code blocks
            bubble.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            // User messages - plain text
            bubble.textContent = message.content;
        }
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = this.formatTime(message.timestamp);
        
        content.appendChild(bubble);
        content.appendChild(time);
        
        // Add sources if available
        if (message.sources && message.sources.length > 0) {
            const sourcesEl = document.createElement('div');
            sourcesEl.className = 'message-sources';
            sourcesEl.innerHTML = '<h4>Sources:</h4>';
            
            message.sources.forEach(source => {
                const link = document.createElement('a');
                link.className = 'source-link';
                link.href = source.url;
                link.target = '_blank';
                link.innerHTML = `<i class="fas fa-external-link-alt"></i> ${source.title}`;
                sourcesEl.appendChild(link);
            });
            
            content.appendChild(sourcesEl);
        }
        
        messageEl.appendChild(avatar);
        messageEl.appendChild(content);
        
        this.messagesContainer.appendChild(messageEl);
    }
    
    showTypingIndicator() {
        const typing = document.createElement('div');
        typing.className = 'message assistant typing';
        typing.id = 'typingIndicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        
        bubble.appendChild(indicator);
        content.appendChild(bubble);
        typing.appendChild(avatar);
        typing.appendChild(content);
        
        this.messagesContainer.appendChild(typing);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typing = document.getElementById('typingIndicator');
        if (typing) typing.remove();
    }
    
    simulateAIResponse(userMessage) {
        this.isTyping = true;
        this.showTypingIndicator();
        
        // Call the real API
        this.streamAIResponse(userMessage);
    }
    
    async streamAIResponse(userMessage) {
        try {
            // Get API URL from config
            const apiUrl = window.PowerNOVA?.config?.apiUrl || 'http://localhost:8000';
            
            // Prepare messages array (include conversation history)
            const messages = this.messages
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
            
            // Call the streaming API
            const response = await fetch(`${apiUrl}/api/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: messages,
                    model: 'gpt-4o-mini',
                    temperature: 0.7,
                    max_tokens: 2000,
                    stream: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            // Hide typing indicator before streaming
            this.hideTypingIndicator();
            
            // Create a message element for streaming content
            const messageId = Date.now();
            const message = {
                id: messageId,
                role: 'assistant',
                content: '',
                timestamp: new Date()
            };
            
            this.messages.push(message);
            this.renderMessage(message);
            
            // Get the message bubble for updating
            const messageEl = this.messagesContainer.querySelector(`[data-id="${messageId}"]`);
            const bubble = messageEl.querySelector('.message-bubble');
            
            // Read the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                // Decode the chunk
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete SSE messages
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6); // Remove 'data: ' prefix
                        
                        if (data === '[DONE]') {
                            this.isTyping = false;
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            // Check for error
                            if (parsed.error) {
                                console.error('Stream error:', parsed.error);
                                bubble.textContent = message.content + '\n\n[Error: ' + parsed.error + ']';
                                this.isTyping = false;
                                break;
                            }
                            
                            // Add content to message
                            if (parsed.content) {
                                message.content += parsed.content;
                                // Re-render markdown on each chunk
                                marked.setOptions({
                                    breaks: true,
                                    gfm: true,
                                    headerIds: false,
                                    mangle: false
                                });
                                bubble.innerHTML = marked.parse(message.content || '');
                                // Apply syntax highlighting to code blocks
                                bubble.querySelectorAll('pre code').forEach((block) => {
                                    hljs.highlightElement(block);
                                });
                                this.scrollToBottom();
                            }
                            
                            // Handle completion
                            if (parsed.done || parsed.finish_reason) {
                                this.isTyping = false;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
            
            this.isTyping = false;
            this.scrollToBottom();
            
            // Show follow-up prompts after AI response
            this.showFollowUpPrompts(message);
            
        } catch (error) {
            console.error('Error calling API:', error);
            this.hideTypingIndicator();
            
            // Show error message to user
            this.addMessage('assistant', 
                `I'm sorry, I encountered an error while processing your request: ${error.message}\n\n` +
                `Please make sure the API is running and accessible. In development, it should be at http://localhost:8000`
            );
            
            this.isTyping = false;
        }
    }
    
    async showFollowUpPrompts(aiMessage) {
        // Remove any existing follow-up prompts
        const existingPrompts = this.messagesContainer.querySelectorAll('.followup-prompts');
        existingPrompts.forEach(el => el.remove());
        
        // Generate contextual follow-up questions using LLM
        const followUps = await this.generateFollowUpQuestions(aiMessage);
        
        if (!followUps || followUps.length === 0) return;
        
        // Create follow-up prompts container
        const promptsContainer = document.createElement('div');
        promptsContainer.className = 'followup-prompts';
        
        const title = document.createElement('h4');
        title.textContent = 'Continue exploring:';
        promptsContainer.appendChild(title);
        
        const grid = document.createElement('div');
        grid.className = 'followup-grid';
        
        followUps.forEach(followUp => {
            const btn = document.createElement('button');
            btn.className = 'followup-btn';
            btn.innerHTML = `<i class="${followUp.icon}"></i><span>${followUp.text}</span>`;
            btn.addEventListener('click', () => {
                this.messageInput.value = followUp.text;
                this.sendBtn.disabled = false;
                this.sendMessage();
            });
            grid.appendChild(btn);
        });
        
        promptsContainer.appendChild(grid);
        this.messagesContainer.appendChild(promptsContainer);
        this.scrollToBottom();
    }
    
    async generateFollowUpQuestions(aiMessage) {
        try {
            // Get API URL from config
            const apiUrl = window.PowerNOVA?.config?.apiUrl || 'http://localhost:8000';
            
            // Get the last few messages for context (up to 4 messages)
            const recentMessages = this.messages
                .slice(-4)
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
            
            // Create a system prompt for generating follow-up questions
            const systemPrompt = `You are a helpful assistant that generates relevant follow-up questions for conversations about energy markets, regulations, and grid operations.

Based on the conversation context, generate exactly 3 relevant follow-up questions that the user might want to ask next. The questions should:
1. Be specific and actionable
2. Build upon the current conversation
3. Explore related topics or dive deeper into mentioned concepts
4. Be relevant to energy markets, CAISO, ERCOT, PJM, MISO, FERC regulations, or grid operations

Return ONLY a JSON array with exactly 3 objects, each with "text" and "icon" properties. Use Font Awesome icon classes.
Example format:
[
  {"text": "What are the timeline requirements?", "icon": "fas fa-clock"},
  {"text": "How do costs compare across regions?", "icon": "fas fa-dollar-sign"},
  {"text": "What are the next steps in the process?", "icon": "fas fa-list-ol"}
]

Available icon classes: fa-clock, fa-dollar-sign, fa-chart-line, fa-file-alt, fa-gavel, fa-industry, fa-bolt, fa-sun, fa-wind, fa-battery-full, fa-plug, fa-network-wired, fa-database, fa-info-circle, fa-list-ol, fa-calendar-alt, fa-tools, fa-shield-alt, fa-globe-americas, fa-exchange-alt, fa-balance-scale`;
            
            // Make API call to generate follow-up questions
            const response = await fetch(`${apiUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...recentMessages
                    ],
                    model: 'gpt-4o-mini',
                    temperature: 0.8,
                    max_tokens: 300
                })
            });
            
            if (!response.ok) {
                console.error('Failed to generate follow-up questions:', response.statusText);
                return this.getFallbackFollowUps();
            }
            
            const data = await response.json();
            const content = data.response || data.content || '';
            
            // Try to parse JSON from the response
            try {
                // Extract JSON array from response (handle cases where LLM adds extra text)
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const followUps = JSON.parse(jsonMatch[0]);
                    
                    // Validate the response
                    if (Array.isArray(followUps) && followUps.length > 0) {
                        // Ensure we have exactly 3 questions with proper structure
                        return followUps.slice(0, 3).filter(q => q.text && q.icon);
                    }
                }
            } catch (parseError) {
                console.error('Error parsing follow-up questions:', parseError);
            }
            
            // Return fallback questions if parsing fails
            return this.getFallbackFollowUps();
            
        } catch (error) {
            console.error('Error generating follow-up questions:', error);
            return this.getFallbackFollowUps();
        }
    }
    
    getFallbackFollowUps() {
        // Fallback questions if API call fails
        const fallbackOptions = [
            [
                { text: "Can you provide more details on this topic?", icon: "fas fa-info-circle" },
                { text: "What are the latest regulatory changes?", icon: "fas fa-newspaper" },
                { text: "How does this compare to other regions?", icon: "fas fa-globe-americas" }
            ],
            [
                { text: "What are the timeline requirements?", icon: "fas fa-clock" },
                { text: "What are the typical costs involved?", icon: "fas fa-dollar-sign" },
                { text: "What documentation is needed?", icon: "fas fa-file-alt" }
            ],
            [
                { text: "How does the process work?", icon: "fas fa-list-ol" },
                { text: "What are common challenges?", icon: "fas fa-exclamation-triangle" },
                { text: "What are best practices?", icon: "fas fa-check-circle" }
            ]
        ];
        
        // Return a random set of fallback questions
        const randomIndex = Math.floor(Math.random() * fallbackOptions.length);
        return fallbackOptions[randomIndex];
    }
    
    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }
    
    startNewChat() {
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.messagesContainer.classList.remove('active');
        this.welcomeScreen.classList.remove('hidden');
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChatApp();
    console.log('PowerNOVA Chat App initialized');
});
