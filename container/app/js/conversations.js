// ==================== //
// Conversations Module //
// ==================== //

const Conversations = {
    currentConversationId: null,
    conversations: [],
    documents: [],
    renameConversationId: null,
    
    /**
     * Initialize conversations module
     */
    async init() {
        // Only load conversations if user is logged in
        if (Auth.token) {
            await this.loadConversations();
        }
        
        this.attachEventListeners();
    },
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // New conversation button
        const newConversationBtn = document.getElementById('newConversationBtn');
        if (newConversationBtn) {
            newConversationBtn.addEventListener('click', () => this.createNewConversation());
        }
        
        // New chat button in header (legacy)
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.createNewConversation());
        }
        
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Document upload button
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => {
                if (!this.currentConversationId) {
                    this.showError('Please start a conversation first before uploading documents');
                    return;
                }
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        // Documents panel toggle
        const documentsBtn = document.getElementById('documentsBtn');
        if (documentsBtn) {
            documentsBtn.addEventListener('click', () => this.toggleDocumentsPanel());
        }
        
        const closeDocumentsPanel = document.getElementById('closeDocumentsPanel');
        if (closeDocumentsPanel) {
            closeDocumentsPanel.addEventListener('click', () => this.toggleDocumentsPanel());
        }
        
        // Rename conversation form
        const renameForm = document.getElementById('renameConversationForm');
        if (renameForm) {
            renameForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitRename();
            });
        }
    },
    
    /**
     * Load all conversations for current user
     */
    async loadConversations() {
        if (!Auth.token) return;
        
        try {
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/conversations`, {
                headers: {
                    'Authorization': `Bearer ${Auth.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load conversations');
            }
            
            this.conversations = await response.json();
            this.renderConversationsList();
            
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    },
    
    /**
     * Render conversations list in sidebar
     */
    renderConversationsList() {
        const conversationsList = document.getElementById('conversationsList');
        const conversationsEmpty = document.getElementById('conversationsEmpty');
        
        if (!conversationsList) return;
        
        // Clear existing conversations (except empty state)
        const existingItems = conversationsList.querySelectorAll('.conversation-item');
        existingItems.forEach(item => item.remove());
        
        if (this.conversations.length === 0) {
            if (conversationsEmpty) {
                conversationsEmpty.style.display = 'flex';
            }
            return;
        }
        
        if (conversationsEmpty) {
            conversationsEmpty.style.display = 'none';
        }
        
        // Render each conversation
        this.conversations.forEach(conversation => {
            const conversationItem = this.createConversationItem(conversation);
            conversationsList.appendChild(conversationItem);
        });
    },
    
    /**
     * Create conversation item element
     */
    createConversationItem(conversation) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.conversationId = conversation.id;
        
        if (conversation.id === this.currentConversationId) {
            item.classList.add('active');
        }
        
        // Format timestamp
        const timestamp = this.formatTimestamp(conversation.updated_at);
        
        item.innerHTML = `
            <div class="conversation-content" onclick="Conversations.switchConversation(${conversation.id})">
                <div class="conversation-icon">
                    <i class="fas fa-comment-dots"></i>
                </div>
                <div class="conversation-info">
                    <div class="conversation-title">${this.escapeHtml(conversation.title)}</div>
                    <div class="conversation-meta">
                        <span class="conversation-time">${timestamp}</span>
                        <span class="conversation-messages">
                            <i class="fas fa-message"></i> ${conversation.message_count}
                        </span>
                        ${conversation.document_count > 0 ? `
                            <span class="conversation-documents">
                                <i class="fas fa-file-alt"></i> ${conversation.document_count}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="conversation-actions">
                <button class="btn-icon-small" onclick="event.stopPropagation(); Conversations.showRenameModal(${conversation.id}, '${this.escapeHtml(conversation.title).replace(/'/g, "\\'")}');" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon-small btn-danger" onclick="event.stopPropagation(); Conversations.deleteConversation(${conversation.id});" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        return item;
    },
    
    /**
     * Create new conversation
     */
    async createNewConversation() {
        if (!Auth.token) {
            Auth.showLoginModal();
            return;
        }
        
        try {
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({
                    title: 'New Conversation'
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create conversation');
            }
            
            const conversation = await response.json();
            
            // Add to conversations list
            this.conversations.unshift(conversation);
            this.renderConversationsList();
            
            // Switch to new conversation
            await this.switchConversation(conversation.id);
            
            // Track with analytics
            if (Analytics.initialized) {
                Analytics.trackEvent('conversation_created', {
                    conversation_id: conversation.id
                });
            }
            
        } catch (error) {
            console.error('Error creating conversation:', error);
            this.showError('Failed to create new conversation');
        }
    },
    
    /**
     * Switch to a different conversation
     */
    async switchConversation(conversationId) {
        if (!Auth.token) {
            Auth.showLoginModal();
            return;
        }
        
        try {
            // Fetch conversation details
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/conversations/${conversationId}`, {
                headers: {
                    'Authorization': `Bearer ${Auth.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load conversation');
            }
            
            const conversation = await response.json();
            
            // Update current conversation
            this.currentConversationId = conversationId;
            this.documents = conversation.documents || [];
            
            // Update UI
            this.updateActiveConversation();
            this.clearMessages();
            this.loadConversationMessages(conversation.messages || []);
            this.updateDocumentsPanel();
            
            // Hide welcome screen, show messages
            const welcomeScreen = document.getElementById('welcomeScreen');
            const messagesContainer = document.getElementById('messagesContainer');
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (messagesContainer) messagesContainer.style.display = 'flex';
            
            // Track with analytics
            if (Analytics.initialized) {
                Analytics.trackEvent('conversation_switched', {
                    conversation_id: conversationId,
                    message_count: conversation.messages?.length || 0
                });
            }
            
        } catch (error) {
            console.error('Error switching conversation:', error);
            this.showError('Failed to load conversation');
        }
    },
    
    /**
     * Delete conversation with confirmation
     */
    async deleteConversation(conversationId) {
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${Auth.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete conversation');
            }
            
            // Remove from list
            this.conversations = this.conversations.filter(c => c.id !== conversationId);
            this.renderConversationsList();
            
            // If deleted conversation was active, clear UI
            if (this.currentConversationId === conversationId) {
                this.currentConversationId = null;
                this.clearMessages();
                this.showWelcomeScreen();
            }
            
            // Track with analytics
            if (Analytics.initialized) {
                Analytics.trackEvent('conversation_deleted', {
                    conversation_id: conversationId
                });
            }
            
        } catch (error) {
            console.error('Error deleting conversation:', error);
            this.showError('Failed to delete conversation');
        }
    },
    
    /**
     * Show rename modal
     */
    showRenameModal(conversationId, currentTitle) {
        this.renameConversationId = conversationId;
        
        const modal = document.getElementById('renameConversationModal');
        const titleInput = document.getElementById('conversationTitle');
        const errorDiv = document.getElementById('renameError');
        
        if (modal && titleInput) {
            titleInput.value = currentTitle;
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
            modal.style.display = 'flex';
            titleInput.focus();
        }
    },
    
    /**
     * Close rename modal
     */
    closeRenameModal() {
        const modal = document.getElementById('renameConversationModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.renameConversationId = null;
    },
    
    /**
     * Submit rename
     */
    async submitRename() {
        const titleInput = document.getElementById('conversationTitle');
        const errorDiv = document.getElementById('renameError');
        
        if (!titleInput || !this.renameConversationId) return;
        
        const newTitle = titleInput.value.trim();
        
        if (!newTitle) {
            errorDiv.textContent = 'Title cannot be empty';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetch(`${window.PowerNOVA.getApiUrl()}/api/conversations/${this.renameConversationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.token}`
                },
                body: JSON.stringify({ title: newTitle })
            });
            
            if (!response.ok) {
                throw new Error('Failed to rename conversation');
            }
            
            // Update in conversations list
            const conversation = this.conversations.find(c => c.id === this.renameConversationId);
            if (conversation) {
                conversation.title = newTitle;
                this.renderConversationsList();
            }
            
            this.closeRenameModal();
            
        } catch (error) {
            console.error('Error renaming conversation:', error);
            errorDiv.textContent = 'Failed to rename conversation';
            errorDiv.style.display = 'block';
        }
    },
    
    /**
     * Handle file upload
     */
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        const allowedTypes = ['.pdf', '.docx', '.txt', '.md'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExt)) {
            this.showError(`File type not supported. Allowed types: ${allowedTypes.join(', ')}`);
            event.target.value = '';
            return;
        }
        
        // Validate file size (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError(`File too large. Maximum size is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
            event.target.value = '';
            return;
        }
        
        // Show upload progress modal
        this.showUploadProgress(file.name);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(
                `${window.PowerNOVA.getApiUrl()}/api/conversations/${this.currentConversationId}/documents`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Auth.token}`
                    },
                    body: formData
                }
            );
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to upload document');
            }
            
            const document = await response.json();
            
            // Add to documents list
            this.documents.push(document);
            this.updateDocumentsPanel();
            
            // Update conversation in list
            const conversation = this.conversations.find(c => c.id === this.currentConversationId);
            if (conversation) {
                conversation.document_count = (conversation.document_count || 0) + 1;
                this.renderConversationsList();
            }
            
            this.hideUploadProgress();
            this.showSuccess(`Document "${file.name}" uploaded successfully`);
            
            // Track with analytics
            if (Analytics.initialized) {
                Analytics.trackEvent('document_uploaded', {
                    conversation_id: this.currentConversationId,
                    file_type: fileExt,
                    file_size: file.size
                });
            }
            
        } catch (error) {
            console.error('Error uploading document:', error);
            this.hideUploadProgress();
            this.showError(error.message || 'Failed to upload document');
        }
        
        // Reset file input
        event.target.value = '';
    },
    
    /**
     * Delete document from conversation
     */
    async deleteDocument(documentId) {
        if (!confirm('Remove this document from the conversation?')) {
            return;
        }
        
        try {
            const response = await fetch(
                `${window.PowerNOVA.getApiUrl()}/api/conversations/${this.currentConversationId}/documents/${documentId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${Auth.token}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to delete document');
            }
            
            // Remove from documents list
            this.documents = this.documents.filter(d => d.id !== documentId);
            this.updateDocumentsPanel();
            
            // Update conversation in list
            const conversation = this.conversations.find(c => c.id === this.currentConversationId);
            if (conversation && conversation.document_count > 0) {
                conversation.document_count--;
                this.renderConversationsList();
            }
            
        } catch (error) {
            console.error('Error deleting document:', error);
            this.showError('Failed to delete document');
        }
    },
    
    /**
     * Update documents panel
     */
    updateDocumentsPanel() {
        const documentsList = document.getElementById('documentsList');
        const documentsBtn = document.getElementById('documentsBtn');
        const documentsCount = document.getElementById('documentsCount');
        
        if (!documentsList) return;
        
        // Clear existing
        documentsList.innerHTML = '';
        
        // Update button count
        if (documentsBtn && documentsCount) {
            if (this.documents.length > 0) {
                documentsBtn.style.display = 'flex';
                documentsCount.textContent = this.documents.length;
            } else {
                documentsBtn.style.display = 'none';
            }
        }
        
        if (this.documents.length === 0) {
            documentsList.innerHTML = `
                <div class="documents-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No documents uploaded</p>
                    <small>Upload documents to enhance AI responses</small>
                </div>
            `;
            return;
        }
        
        // Render documents
        this.documents.forEach(doc => {
            const docItem = this.createDocumentItem(doc);
            documentsList.appendChild(docItem);
        });
    },
    
    /**
     * Create document item element
     */
    createDocumentItem(doc) {
        const item = document.createElement('div');
        item.className = 'document-item';
        
        const icon = this.getDocumentIcon(doc.document_type);
        const statusBadge = this.getStatusBadge(doc.status);
        const fileSize = this.formatFileSize(doc.file_size);
        
        item.innerHTML = `
            <div class="document-icon">
                <i class="${icon}"></i>
            </div>
            <div class="document-info">
                <div class="document-title">${this.escapeHtml(doc.title)}</div>
                <div class="document-meta">
                    <span>${fileSize}</span>
                    ${doc.chunk_count > 0 ? `<span><i class="fas fa-check"></i> Indexed</span>` : ''}
                </div>
            </div>
            <div class="document-status">${statusBadge}</div>
            <button class="btn-icon-small btn-danger" onclick="Conversations.deleteDocument(${doc.id})" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        return item;
    },
    
    /**
     * Toggle documents panel
     */
    toggleDocumentsPanel() {
        const panel = document.getElementById('documentsPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    },
    
    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('conversationsSidebar');
        const toggle = document.getElementById('sidebarToggle');
        
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            
            if (toggle) {
                const icon = toggle.querySelector('i');
                if (icon) {
                    icon.className = sidebar.classList.contains('collapsed') 
                        ? 'fas fa-chevron-right' 
                        : 'fas fa-chevron-left';
                }
            }
        }
    },
    
    /**
     * Update active conversation in UI
     */
    updateActiveConversation() {
        const items = document.querySelectorAll('.conversation-item');
        items.forEach(item => {
            const id = parseInt(item.dataset.conversationId);
            if (id === this.currentConversationId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },
    
    /**
     * Load conversation messages into UI
     */
    loadConversationMessages(messages) {
        messages.forEach(msg => {
            if (typeof window.addMessageToUI === 'function') {
                window.addMessageToUI(msg.role, msg.content, msg.role === 'assistant');
            }
        });
    },
    
    /**
     * Clear messages from UI
     */
    clearMessages() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
    },
    
    /**
     * Show welcome screen
     */
    showWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const messagesContainer = document.getElementById('messagesContainer');
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
        if (messagesContainer) messagesContainer.style.display = 'none';
    },
    
    /**
     * Show upload progress modal
     */
    showUploadProgress(fileName) {
        const modal = document.getElementById('uploadProgressModal');
        const fileNameElement = document.getElementById('uploadFileName');
        const progressBar = document.getElementById('uploadProgress');
        const statusElement = document.getElementById('uploadStatus');
        
        if (modal && fileNameElement && progressBar && statusElement) {
            fileNameElement.textContent = fileName;
            progressBar.style.width = '0%';
            statusElement.textContent = 'Uploading...';
            modal.style.display = 'flex';
            
            // Simulate progress (since we don't have real progress tracking)
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                if (progress <= 90) {
                    progressBar.style.width = progress + '%';
                } else {
                    clearInterval(interval);
                }
            }, 100);
        }
    },
    
    /**
     * Hide upload progress modal
     */
    hideUploadProgress() {
        const modal = document.getElementById('uploadProgressModal');
        if (modal) {
            setTimeout(() => {
                modal.style.display = 'none';
            }, 500);
        }
    },
    
    // ==================== Utility Functions ==================== //
    
    getDocumentIcon(docType) {
        const icons = {
            'pdf': 'fas fa-file-pdf',
            'docx': 'fas fa-file-word',
            'txt': 'fas fa-file-alt',
            'markdown': 'fas fa-file-code',
            'md': 'fas fa-file-code'
        };
        return icons[docType] || 'fas fa-file';
    },
    
    getStatusBadge(status) {
        const badges = {
            'completed': '<span class="status-badge status-completed"><i class="fas fa-check"></i> Ready</span>',
            'processing': '<span class="status-badge status-processing"><i class="fas fa-spinner fa-spin"></i> Processing</span>',
            'failed': '<span class="status-badge status-failed"><i class="fas fa-exclamation-triangle"></i> Failed</span>',
            'pending': '<span class="status-badge status-pending"><i class="fas fa-clock"></i> Pending</span>'
        };
        return badges[status] || badges['pending'];
    },
    
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    showError(message) {
        // Simple alert for now - can be improved with toast notifications
        alert('Error: ' + message);
    },
    
    showSuccess(message) {
        // Simple alert for now - can be improved with toast notifications
        console.log('Success: ' + message);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Conversations will be initialized after Auth
    });
} else {
    // DOM already loaded
}
