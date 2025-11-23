/**
 * Profile Page - User Profile and Document Management
 */

// Get API URL from config
const API_URL = window.PowerNOVA?.config?.apiUrl || 'http://localhost:8000';

class ProfileManager {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.user = null;
        this.documents = [];
        this.currentScope = 'all';
        
        this.init();
    }

    init() {
        // Check authentication
        if (!this.token) {
            window.location.href = 'index.html';
            return;
        }

        // Set up event listeners
        this.setupEventListeners();
        
        // Load data
        this.loadProfile();
        this.loadDocuments();
    }

    setupEventListeners() {
        // Back to chat button
        const backToChatBtn = document.getElementById('backToChatBtn');
        if (backToChatBtn) {
            backToChatBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // Edit profile button
        const editProfileBtn = document.getElementById('editProfileBtn');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => this.showEditProfileModal());
        }

        // Change password button
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.showChangePasswordModal());
        }

        // Upload document buttons
        document.getElementById('uploadDocumentBtn')?.addEventListener('click', () => this.showUploadModal());
        document.getElementById('uploadDocumentBtn2')?.addEventListener('click', () => this.showUploadModal());

        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentScope = e.target.closest('.tab-btn').dataset.scope;
                this.switchTab();
            });
        });

        // Forms
        document.getElementById('editProfileForm')?.addEventListener('submit', (e) => this.handleEditProfile(e));
        document.getElementById('changePasswordForm')?.addEventListener('submit', (e) => this.handleChangePassword(e));
        document.getElementById('uploadDocumentForm')?.addEventListener('submit', (e) => this.handleUploadDocument(e));

        // File input
        document.getElementById('documentFile')?.addEventListener('change', (e) => this.handleFileSelect(e));

        // User menu
        const userMenuBtn = document.getElementById('userMenuBtn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => this.toggleUserMenu());
        }

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            const userMenu = document.getElementById('userMenu');
            const userMenuBtn = document.getElementById('userMenuBtn');
            if (userMenu && userMenuBtn && !userMenuBtn.contains(e.target) && !userMenu.contains(e.target)) {
                this.hideUserMenu();
            }
        });
    }

    async loadProfile() {
        try {
            const response = await fetch(`${API_URL}/api/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return;
                }
                throw new Error('Failed to load profile');
            }

            this.user = await response.json();
            this.renderProfile();
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showError('Failed to load profile');
        }
    }

    renderProfile() {
        if (!this.user) return;

        // Update profile info
        document.getElementById('profileUsername').textContent = this.user.username;
        document.getElementById('profileEmail').textContent = this.user.email;
        document.getElementById('usernameText').textContent = this.user.username;
        document.getElementById('userEmail2').textContent = this.user.email;

        // Update badges
        document.getElementById('activeBadge').style.display = this.user.is_active ? 'inline-flex' : 'none';
        document.getElementById('verifiedBadge').style.display = this.user.is_verified ? 'inline-flex' : 'none';

        // Update stats
        document.getElementById('totalConversations').textContent = this.user.total_conversations;
        document.getElementById('totalDocuments').textContent = this.user.total_documents;
        document.getElementById('totalMessages').textContent = this.user.total_messages;

        // Show user menu button
        document.getElementById('userMenuBtn').style.display = 'flex';
    }

    async loadDocuments() {
        try {
            const scopeParam = this.currentScope !== 'all' ? `?scope=${this.currentScope}` : '';
            const response = await fetch(`${API_URL}/api/users/documents${scopeParam}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load documents');
            }

            this.documents = await response.json();
            this.renderDocuments();
        } catch (error) {
            console.error('Error loading documents:', error);
            this.showError('Failed to load documents');
            this.renderDocuments(); // Render empty state
        }
    }

    renderDocuments() {
        const grid = document.getElementById('documentsGrid');
        const empty = document.getElementById('documentsEmpty');

        if (this.documents.length === 0) {
            grid.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        empty.style.display = 'none';

        grid.innerHTML = this.documents.map(doc => this.renderDocumentCard(doc)).join('');

        // Add event listeners for document actions
        this.documents.forEach(doc => {
            const viewBtn = document.getElementById(`view-${doc.id}`);
            const deleteBtn = document.getElementById(`delete-${doc.id}`);

            if (viewBtn) {
                viewBtn.addEventListener('click', () => this.viewDocument(doc));
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteDocument(doc));
            }
        });
    }

    renderDocumentCard(doc) {
        const fileExt = doc.document_type.toLowerCase();
        const scopeClass = doc.document_scope === 'user' ? 'scope-user' : 'scope-conversation';
        const scopeIcon = doc.document_scope === 'user' ? 'fa-book' : 'fa-comments';
        const scopeLabel = doc.document_scope === 'user' ? 'My Library' : 'Conversation';
        
        const statusClass = `status-${doc.status.toLowerCase()}`;
        const statusIcon = doc.status === 'COMPLETED' ? 'fa-check-circle' : 
                          doc.status === 'PROCESSING' ? 'fa-spinner fa-spin' : 'fa-exclamation-circle';

        const conversationInfo = doc.conversation_title ? 
            `<div class="document-meta">
                <i class="fas fa-comments"></i> ${doc.conversation_title}
            </div>` : '';

        const chunks = doc.chunk_count ? `${doc.chunk_count} chunks` : 'No chunks';

        return `
            <div class="document-card">
                <div class="document-icon ${fileExt}">
                    <i class="fas fa-file-${fileExt === 'pdf' ? 'pdf' : fileExt === 'docx' ? 'word' : 'alt'}"></i>
                </div>
                <div class="document-title" title="${doc.title}">${doc.title}</div>
                <div class="document-scope ${scopeClass}">
                    <i class="fas ${scopeIcon}"></i>
                    ${scopeLabel}
                </div>
                ${conversationInfo}
                <div class="document-status">
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${statusIcon}"></i>
                        ${doc.status}
                    </span>
                    <span style="font-size: 0.75rem; color: #6b7280;">${chunks}</span>
                </div>
                <div class="document-meta">
                    <i class="fas fa-calendar"></i>
                    ${new Date(doc.created_at).toLocaleDateString()}
                </div>
                <div class="document-actions">
                    <button class="btn-icon-small" id="view-${doc.id}" title="View Document">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon-small delete" id="delete-${doc.id}" title="Delete Document">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    switchTab() {
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scope === this.currentScope);
        });

        // Reload documents
        this.loadDocuments();
    }

    // Modals
    showEditProfileModal() {
        document.getElementById('editUsername').value = this.user.username;
        document.getElementById('editEmail').value = this.user.email;
        document.getElementById('editProfileModal').style.display = 'flex';
    }

    showChangePasswordModal() {
        document.getElementById('changePasswordForm').reset();
        document.getElementById('changePasswordModal').style.display = 'flex';
    }

    showUploadModal() {
        document.getElementById('uploadDocumentForm').reset();
        document.getElementById('fileSelected').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadDocumentModal').style.display = 'flex';
    }

    async handleEditProfile(e) {
        e.preventDefault();

        const username = document.getElementById('editUsername').value.trim();

        try {
            const response = await fetch(`${API_URL}/api/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ username })
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            this.user = await response.json();
            this.renderProfile();
            closeEditProfileModal();
            this.showSuccess('Profile updated successfully');
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showError('Failed to update profile');
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/users/profile/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to change password');
            }

            closeChangePasswordModal();
            this.showSuccess('Password changed successfully');
        } catch (error) {
            console.error('Error changing password:', error);
            this.showError(error.message || 'Failed to change password');
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSelected').style.display = 'flex';
        }
    }

    async handleUploadDocument(e) {
        e.preventDefault();

        const fileInput = document.getElementById('documentFile');
        const file = fileInput.files[0];

        if (!file) {
            this.showError('Please select a file');
            return;
        }

        // Validate file size (10MB max)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            this.showError('File too large. Maximum size is 10MB');
            return;
        }

        // Show progress
        document.getElementById('uploadProgress').style.display = 'block';
        document.getElementById('uploadSubmitBtn').disabled = true;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/api/users/documents`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to upload document');
            }

            const result = await response.json();
            
            closeUploadModal();
            this.showSuccess(`Document "${result.title}" uploaded successfully to your library`);
            
            // Reload documents and profile
            this.loadDocuments();
            this.loadProfile();

        } catch (error) {
            console.error('Error uploading document:', error);
            this.showError(error.message || 'Failed to upload document');
        } finally {
            document.getElementById('uploadProgress').style.display = 'none';
            document.getElementById('uploadSubmitBtn').disabled = false;
        }
    }

    viewDocument(doc) {
        if (doc.blob_url) {
            window.open(doc.blob_url, '_blank');
        } else {
            this.showError('Document URL not available');
        }
    }

    async deleteDocument(doc) {
        if (!confirm(`Are you sure you want to delete "${doc.title}"?\n\nThis will remove it from all conversations.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/users/documents/${doc.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete document');
            }

            this.showSuccess(`Document "${doc.title}" deleted successfully`);
            this.loadDocuments();
            this.loadProfile();

        } catch (error) {
            console.error('Error deleting document:', error);
            this.showError('Failed to delete document');
        }
    }

    toggleUserMenu() {
        const menu = document.getElementById('userMenu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }

    hideUserMenu() {
        document.getElementById('userMenu').style.display = 'none';
    }

    logout() {
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Modal close functions (global)
function closeEditProfileModal() {
    document.getElementById('editProfileModal').style.display = 'none';
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
}

function closeUploadModal() {
    document.getElementById('uploadDocumentModal').style.display = 'none';
}

function clearFileSelection() {
    document.getElementById('documentFile').value = '';
    document.getElementById('fileSelected').style.display = 'none';
}

// Close modal when clicking outside
function setupModalBackdropClose() {
    const modals = ['editProfileModal', 'changePasswordModal', 'uploadDocumentModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.profileManager = new ProfileManager();
    setupModalBackdropClose();
});
