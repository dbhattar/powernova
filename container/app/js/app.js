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
        bubble.textContent = message.content;
        
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
        
        // Simulate API delay
        setTimeout(() => {
            this.hideTypingIndicator();
            
            // Generate mock response based on question
            const response = this.generateMockResponse(userMessage);
            this.addMessage('assistant', response.content, response.sources);
            
            this.isTyping = false;
        }, 1500 + Math.random() * 1000);
    }
    
    generateMockResponse(question) {
        const lowerQuestion = question.toLowerCase();
        
        // Mock responses for demo purposes
        if (lowerQuestion.includes('caiso') || lowerQuestion.includes('interconnection')) {
            return {
                content: "CAISO's interconnection procedures are governed by their Generator Interconnection and Deliverability Allocation Procedures (GIDAP). The latest procedures include a transition to a cluster study process, enhanced deliverability assessment, and updated timelines for study completion. Key requirements include a $10,000 study deposit and adherence to specific milestone deadlines.\n\nThe process typically takes 2-3 years from application to commercial operation, with multiple study phases including Phase I and Phase II interconnection studies.",
                sources: [
                    { title: "CAISO GIDAP Manual - Section 3.5", url: "#" },
                    { title: "Business Practice Manual for Generator Management", url: "#" }
                ]
            };
        }
        
        if (lowerQuestion.includes('ferc') || lowerQuestion.includes('order 2023')) {
            return {
                content: "FERC Order 2023, issued in July 2023, represents a major reform of the generator interconnection process. Key provisions include:\n\n1. First-Ready, First-Served cluster study approach\n2. Incorporation of technological advancements in study assumptions\n3. Enhanced information requirements for interconnection requests\n4. Penalties for late withdrawals from the queue\n5. Improved alternative transmission technology considerations\n\nThe order aims to reduce interconnection timelines and improve the efficiency of the queue management process across all RTOs and ISOs.",
                sources: [
                    { title: "FERC Order No. 2023", url: "#" },
                    { title: "Order 2023 Implementation Guide", url: "#" }
                ]
            };
        }
        
        if (lowerQuestion.includes('ercot') || lowerQuestion.includes('market design')) {
            return {
                content: "ERCOT operates as an energy-only market without a centralized capacity market. Key features of ERCOT's market design include:\n\n• Day-Ahead Market (DAM): Voluntary market for energy and ancillary services\n• Real-Time Market (RTM): Balances supply and demand every 5 minutes\n• Ancillary Services: Including Regulation, Responsive Reserve, and Non-Spinning Reserve\n• Operating Reserve Demand Curve (ORDC): Provides scarcity pricing signals\n• No capacity market: Relies on energy and ancillary service revenues\n\nERCOT's unique design reflects Texas's deregulated electricity market structure and its isolation from other interconnections.",
                sources: [
                    { title: "ERCOT Nodal Protocols - Section 4", url: "#" },
                    { title: "ERCOT Market Guide", url: "#" }
                ]
            };
        }
        
        if (lowerQuestion.includes('pjm') && lowerQuestion.includes('miso')) {
            return {
                content: "PJM and MISO both operate capacity markets, but with different designs:\n\n**PJM's Reliability Pricing Model (RPM):**\n• Forward capacity auctions (Base Residual Auction 3 years ahead)\n• Locational deliverability requirements\n• Performance-based capacity payments\n• Minimum Offer Price Rule (MOPR)\n\n**MISO's Resource Adequacy:**\n• Annual Planning Resource Auction\n• Zonal capacity requirements\n• Seasonal construct (summer/winter)\n• Accreditation based on ELCC methodology\n\nBoth markets aim to ensure resource adequacy, but PJM's market is more mature and typically shows higher clearing prices due to tighter capacity conditions in certain zones.",
                sources: [
                    { title: "PJM RPM Design", url: "#" },
                    { title: "MISO Resource Adequacy Business Practice Manual", url: "#" }
                ]
            };
        }
        
        // Default response
        return {
            content: `Thank you for your question about "${question}". This is a demo version of PowerNOVA Chat. In the full version, I would search through thousands of regulatory documents, tariffs, market rules, and operational procedures from ISO/RTO markets to provide you with accurate, cited answers.\n\nThe actual implementation will use advanced RAG (Retrieval-Augmented Generation) technology to:\n• Search relevant documents in real-time\n• Extract pertinent information\n• Synthesize a comprehensive answer\n• Provide source citations for verification\n\nFor now, try asking about CAISO interconnection procedures, FERC Order 2023, ERCOT market design, or comparing PJM and MISO capacity markets to see example responses!`,
            sources: null
        };
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
