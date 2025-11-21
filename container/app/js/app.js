// ==================== //
// PowerNOVA Chat App   //
// ==================== //

// ============================================
// AUTHENTICATION MODULE
// ============================================
const Auth = {
    token: null,
    user: null,
    
    init() {
        // Check if user is logged in
        this.token = localStorage.getItem('auth_token');
        if (this.token) {
            this.verifyToken();
        } else {
            this.showGuestMode();
        }
        
        this.attachAuthListeners();
    },
    
    attachAuthListeners() {
        // Login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showLoginModal());
        }
        
        // User menu button
        const userMenuBtn = document.getElementById('userMenuBtn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => this.toggleUserMenu());
        }
        
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }
        
        // Password change form
        const passwordChangeForm = document.getElementById('passwordChangeForm');
        if (passwordChangeForm) {
            passwordChangeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        // Change password from menu
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                this.hideUserMenu();
                this.showPasswordChangeModal();
            });
        }
        
        // Close modal when clicking overlay
        const modals = ['loginModal', 'passwordChangeModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModal(modalId);
                    }
                });
            }
        });
    },
    
    showGuestMode() {
        document.getElementById('loginBtn').style.display = 'flex';
        document.getElementById('userMenuBtn').style.display = 'none';
    },
    
    showLoggedInMode(user) {
        this.user = user;
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userMenuBtn').style.display = 'flex';
        document.getElementById('usernameText').textContent = user.username;
        document.getElementById('userEmail').textContent = user.email;
    },
    
    async verifyToken() {
        try {
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const user = await response.json();
                this.showLoggedInMode(user);
                
                // Check if password must be changed
                if (user.must_change_password) {
                    this.showPasswordChangeModal();
                }
            } else {
                // Token invalid, logout
                this.logout();
            }
        } catch (error) {
            console.error('Auth verification failed:', error);
            this.logout();
        }
    },
    
    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const submitBtn = document.getElementById('loginSubmitBtn');
        const errorEl = document.getElementById('loginError');
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        errorEl.style.display = 'none';
        
        try {
            const formData = new URLSearchParams();
            formData.append('username', email); // OAuth2 uses 'username' field
            formData.append('password', password);
            
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                this.token = data.access_token;
                localStorage.setItem('auth_token', this.token);
                
                this.closeLoginModal();
                this.showLoggedInMode(data.user);
                
                // Track successful login
                if (window.PowerNOVA?.Analytics) {
                    window.PowerNOVA.Analytics.trackLogin('email');
                    window.PowerNOVA.Analytics.setUserId(String(data.user.id));
                    window.PowerNOVA.Analytics.setUserProperties({
                        user_type: data.user.is_superuser ? 'admin' : 'user',
                        email_verified: data.user.is_verified
                    });
                }
                
                // Check if must change password
                if (data.must_change_password) {
                    this.showPasswordChangeModal();
                } else {
                    this.showSuccessToast('Welcome back!');
                }
            } else {
                const error = await response.json();
                errorEl.textContent = error.detail || 'Invalid email or password';
                errorEl.style.display = 'block';
            }
        } catch (error) {
            errorEl.textContent = 'Connection error. Please try again.';
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    },
    
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const submitBtn = document.getElementById('passwordChangeSubmitBtn');
        const errorEl = document.getElementById('passwordChangeError');
        
        errorEl.style.display = 'none';
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            errorEl.textContent = 'New passwords do not match';
            errorEl.style.display = 'block';
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';
        
        try {
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                // Update token
                this.token = data.access_token;
                localStorage.setItem('auth_token', this.token);
                
                this.closePasswordChangeModal();
                this.showSuccessToast('Password changed successfully!');
                
                // Refresh user data
                this.verifyToken();
            } else {
                const error = await response.json();
                errorEl.textContent = error.detail || 'Failed to change password';
                errorEl.style.display = 'block';
            }
        } catch (error) {
            errorEl.textContent = 'Connection error. Please try again.';
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-key"></i> Change Password';
        }
    },
    
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        this.showGuestMode();
        this.hideUserMenu();
        this.showSuccessToast('Logged out successfully');
    },
    
    showLoginModal() {
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('loginEmail').focus();
    },
    
    closeLoginModal() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('loginForm').reset();
        document.getElementById('loginError').style.display = 'none';
    },
    
    showPasswordChangeModal() {
        document.getElementById('passwordChangeModal').style.display = 'flex';
        document.getElementById('currentPassword').focus();
    },
    
    closePasswordChangeModal() {
        document.getElementById('passwordChangeModal').style.display = 'none';
        document.getElementById('passwordChangeForm').reset();
        document.getElementById('passwordChangeError').style.display = 'none';
    },
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    toggleUserMenu() {
        const menu = document.getElementById('userMenu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    },
    
    hideUserMenu() {
        document.getElementById('userMenu').style.display = 'none';
    },
    
    showSuccessToast(message) {
        // Simple toast notification (you can enhance this)
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            animation: slideIn 0.3s ease-out;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    requireAuth(callback) {
        if (!this.token) {
            this.showLoginModal();
            return false;
        }
        callback();
        return true;
    }
};

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const userMenuBtn = document.getElementById('userMenuBtn');
    
    if (userMenu && !userMenuBtn.contains(e.target) && !userMenu.contains(e.target)) {
        Auth.hideUserMenu();
    }
});

// Helper function to close modals
function closeLoginModal() {
    Auth.closeLoginModal();
}

function closePasswordChangeModal() {
    Auth.closePasswordChangeModal();
}

// ============================================
// END AUTHENTICATION MODULE
// ============================================

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
                
                // Track example question clicked
                if (window.PowerNOVA?.Analytics) {
                    window.PowerNOVA.Analytics.trackExampleClick(question);
                }
                
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
        
        // Track chat message sent
        if (window.PowerNOVA?.Analytics) {
            window.PowerNOVA.Analytics.trackChatMessage({
                messageLength: text.length,
                conversationLength: this.messages.length
            });
        }
        
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
            
            // Call the streaming API with RAG enabled
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
                    stream: true,
                    use_rag: true,  // Enable RAG
                    top_k: 5,
                    similarity_threshold: 0.5
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
                sources: null,  // Will be populated from RAG
                timestamp: new Date()
            };
            
            this.messages.push(message);
            this.renderMessage(message);
            
            // Get the message bubble for updating
            const messageEl = this.messagesContainer.querySelector(`[data-id="${messageId}"]`);
            const bubble = messageEl.querySelector('.message-bubble');
            const messageContent = messageEl.querySelector('.message-content');
            
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
                            
                            // Handle sources (sent first by RAG)
                            if (parsed.type === 'sources' && parsed.sources) {
                                message.sources = parsed.sources;
                                // Update the rendered message to include sources
                                const existingSources = messageContent.querySelector('.message-sources');
                                if (existingSources) {
                                    existingSources.remove();
                                }
                                
                                const sourcesEl = document.createElement('div');
                                sourcesEl.className = 'message-sources';
                                sourcesEl.innerHTML = '<h4>Sources:</h4>';
                                
                                parsed.sources.forEach(source => {
                                    const link = document.createElement('a');
                                    link.className = 'source-link';
                                    link.href = source.url;
                                    link.target = '_blank';
                                    link.innerHTML = `<i class="fas fa-external-link-alt"></i> ${source.title}`;
                                    sourcesEl.appendChild(link);
                                });
                                
                                messageContent.appendChild(sourcesEl);
                            }
                            
                            // Handle content
                            if (parsed.type === 'content') {
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
                            }
                            
                            // Handle error type
                            if (parsed.type === 'error') {
                                console.error('Stream error:', parsed.error);
                                bubble.textContent = message.content + '\n\n[Error: ' + parsed.error + ']';
                                this.isTyping = false;
                                break;
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
                // Track follow-up question clicked
                if (window.PowerNOVA?.Analytics) {
                    window.PowerNOVA.Analytics.trackFollowUpClick(followUp.text);
                }
                
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
            
            // Make API call to generate follow-up questions using dedicated endpoint
            const response = await fetch(`${apiUrl}/api/chat/follow-up-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: recentMessages,
                    count: 3
                })
            });
            
            if (!response.ok) {
                console.error('Failed to generate follow-up questions:', response.statusText);
                return this.getFallbackFollowUps();
            }
            
            const data = await response.json();
            
            // Validate the response
            if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
                return data.questions;
            }
            
            // Return fallback questions if no valid questions returned
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
        // Require authentication for new chats
        Auth.requireAuth(() => {
            // Track new chat started
            if (window.PowerNOVA?.Analytics) {
                window.PowerNOVA.Analytics.trackNewChat();
            }
            
            this.messages = [];
            this.messagesContainer.innerHTML = '';
            this.messagesContainer.classList.remove('active');
            this.welcomeScreen.classList.remove('hidden');
            this.messageInput.value = '';
            this.sendBtn.disabled = true;
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Google Analytics first (production only)
    if (window.PowerNOVA?.Analytics) {
        await window.PowerNOVA.Analytics.init();
    }
    
    // Initialize authentication
    Auth.init();
    
    // Then initialize chat app
    const app = new ChatApp();
    console.log('PowerNOVA Chat App initialized');
});
