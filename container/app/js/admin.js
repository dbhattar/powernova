/**
 * PowerNOVA Admin Dashboard - JavaScript
 * Handles all admin functionality including crawl management, embedding processing, and user management
 */

// Determine API base URL
// Local development: http://localhost:8081 -> http://localhost:8000/api
// Production: https://app.powernova.ai -> https://api.powernova.ai/api
let API_BASE;
const currentOrigin = window.location.origin;

if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
    // Local development - API is always on port 8000
    API_BASE = currentOrigin.replace(/:\d+/, ':8000') + '/api';
} else if (currentOrigin.includes('app.powernova.ai')) {
    // Production - API subdomain
    API_BASE = 'https://api.powernova.ai/api';
} else {
    // Fallback - assume API is on same origin
    API_BASE = currentOrigin + '/api';
}

console.log('API Base URL:', API_BASE);

let adminKey = localStorage.getItem('admin_key') || '';
let currentTab = 'overview';
let embeddingPage = 0;
const ITEMS_PER_PAGE = 20;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!adminKey) {
        adminKey = prompt('Enter admin key:');
        if (adminKey) {
            localStorage.setItem('admin_key', adminKey);
        } else {
            showAlert('Admin key required', 'error');
            return;
        }
    }
    loadOverview();
});

// Tab Switching
function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`content-${tab}`).classList.add('active');

    currentTab = tab;

    // Load tab data
    if (tab === 'overview') loadOverview();
    else if (tab === 'crawl') loadCrawlJobs();
    else if (tab === 'embeddings') loadEmbeddings();
    else if (tab === 'users') loadUsers();
    else if (tab === 'feedback') loadFeedback();
}

// API Helper
async function apiCall(endpoint, options = {}) {
    try {
        const url = `${API_BASE}${endpoint}`;
        console.log('API Call:', url); // Debug logging
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'X-Admin-Key': adminKey,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (response.status === 401 || response.status === 403) {
            showAlert('Invalid admin key. Please update.', 'error');
            changeAdminKey();
            throw new Error('Invalid admin key');
        }

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorMsg = `Request failed with status ${response.status}`;
            
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                errorMsg = error.detail || error.message || errorMsg;
            } else {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 200));
                errorMsg = `API returned HTML instead of JSON. Check if endpoint exists: ${url}`;
            }
            
            throw new Error(errorMsg);
        }

        // Handle responses with no content (204 No Content, DELETE responses, etc.)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return null;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            
            // Empty response is OK for some operations (DELETE, etc.)
            if (!text || text.trim() === '') {
                return null;
            }
            
            console.error('Expected JSON, got:', text.substring(0, 200));
            throw new Error(`API returned non-JSON response. Got: ${text.substring(0, 50)}...`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showAlert(error.message, 'error');
        throw error;
    }
}

// Alert System
function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);

    setTimeout(() => alert.remove(), 5000);
}

// Overview Tab
async function loadOverview() {
    try {
        const stats = await apiCall('/admin/stats');
        
        document.getElementById('stat-total-jobs').textContent = stats.crawl_jobs.total;
        document.getElementById('stat-running-jobs').textContent = stats.crawl_jobs.running;
        document.getElementById('stat-total-docs').textContent = stats.documents.total;
        document.getElementById('stat-with-embeddings').textContent = stats.documents.with_embeddings;
        document.getElementById('stat-total-chunks').textContent = stats.embeddings?.total_chunks || 0;
        document.getElementById('stat-migration-percent').textContent = 
            (stats.embeddings?.migration_progress || 0).toFixed(1) + '%';
        document.getElementById('stat-total-users').textContent = stats.users.total;
        document.getElementById('stat-active-users').textContent = stats.users.active;

        const progress = stats.embeddings?.migration_progress || 0;
        document.getElementById('migration-progress').style.width = progress + '%';
        document.getElementById('migration-progress').textContent = progress.toFixed(1) + '%';
    } catch (error) {
        showAlert('Failed to load overview: ' + error.message, 'error');
    }
}

// Crawl Management Tab
async function loadCrawlJobs() {
    try {
        const jobs = await apiCall('/admin/crawl?limit=50');
        const container = document.getElementById('crawl-jobs-container');

        // Update stats
        const statusCounts = jobs.reduce((acc, job) => {
            acc[job.status] = (acc[job.status] || 0) + 1;
            return acc;
        }, {});

        document.getElementById('crawl-total').textContent = jobs.length;
        document.getElementById('crawl-running').textContent = statusCounts.RUNNING || 0;
        document.getElementById('crawl-completed').textContent = statusCounts.COMPLETED || 0;
        document.getElementById('crawl-failed').textContent = statusCounts.FAILED || 0;

        // Render table
        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🕷️</div>
                    <h3>No Crawl Jobs</h3>
                    <p>Create a new crawl job to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Start URL</th>
                        <th>Status</th>
                        <th>Pages</th>
                        <th>Documents</th>
                        <th>Started</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${jobs.map(job => `
                        <tr>
                            <td>#${job.id}</td>
                            <td><a href="${job.start_url}" target="_blank">${job.start_url}</a></td>
                            <td><span class="badge badge-${getStatusBadge(job.status)}">${job.status}</span></td>
                            <td>${job.pages_crawled}</td>
                            <td>${job.documents_found}</td>
                            <td>${job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}</td>
                            <td>
                                ${job.status === 'RUNNING' ? 
                                    `<button class="action-btn action-btn-danger" onclick="cancelCrawl(${job.id})">Cancel</button>` : 
                                    `<button class="action-btn action-btn-danger" onclick="deleteCrawl(${job.id})">Delete</button>`
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        showAlert('Failed to load crawl jobs: ' + error.message, 'error');
    }
}

function getStatusBadge(status) {
    const map = {
        'COMPLETED': 'success',
        'RUNNING': 'info',
        'PENDING': 'warning',
        'FAILED': 'danger',
        'CANCELLED': 'secondary'
    };
    return map[status] || 'secondary';
}

async function showCreateCrawlModal() {
    document.getElementById('create-crawl-modal').classList.add('active');
}

async function createCrawlJob(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const data = {
        start_url: formData.get('start_url'),
        max_depth: parseInt(formData.get('max_depth')),
        max_pages: parseInt(formData.get('max_pages')),
        allowed_domains: formData.get('allowed_domains') ? 
            formData.get('allowed_domains').split(',').map(d => d.trim()) : [],
        file_types: ['html', 'pdf'],
        include_patterns: [],
        exclude_patterns: []
    };

    try {
        await apiCall('/admin/crawl', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showAlert('Crawl job created successfully!', 'success');
        closeModal('create-crawl-modal');
        form.reset();
        loadCrawlJobs();
    } catch (error) {
        showAlert('Failed to create crawl job: ' + error.message, 'error');
    }
}

async function cancelCrawl(id) {
    if (!confirm('Cancel this crawl job?')) return;

    try {
        await apiCall(`/admin/crawl/${id}/cancel`, { method: 'POST' });
        showAlert('Crawl job cancelled', 'success');
        loadCrawlJobs();
    } catch (error) {
        showAlert('Failed to cancel: ' + error.message, 'error');
    }
}

async function deleteCrawl(id) {
    if (!confirm('Delete this crawl job and all its documents?')) return;

    try {
        await apiCall(`/admin/crawl/${id}`, { method: 'DELETE' });
        showAlert('Crawl job deleted', 'success');
        loadCrawlJobs();
    } catch (error) {
        showAlert('Failed to delete: ' + error.message, 'error');
    }
}

// Embeddings Tab
async function loadEmbeddings() {
    try {
        const stats = await apiCall('/admin/embeddings/stats');
        
        document.getElementById('emb-total-docs').textContent = stats.summary.total_documents;
        document.getElementById('emb-with-chunks').textContent = stats.summary.documents_with_chunks;
        document.getElementById('emb-old-embeddings').textContent = stats.summary.documents_with_old_embeddings;
        document.getElementById('emb-total-chunks').textContent = stats.summary.total_chunks;

        await loadEmbeddingDocuments();
    } catch (error) {
        showAlert('Failed to load embedding stats: ' + error.message, 'error');
    }
}

async function loadEmbeddingDocuments() {
    try {
        const scope = document.getElementById('emb-scope-filter').value;
        const params = new URLSearchParams({
            skip: embeddingPage * ITEMS_PER_PAGE,
            limit: ITEMS_PER_PAGE
        });
        if (scope) params.append('scope', scope);

        const data = await apiCall(`/admin/embeddings/documents-needing-reprocessing?${params}`);
        const container = document.getElementById('embedding-docs-container');

        if (data.documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <h3>All Documents Migrated!</h3>
                    <p>No documents need reprocessing</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Scope</th>
                        <th>Size</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.documents.map(doc => `
                        <tr>
                            <td>#${doc.id}</td>
                            <td title="${doc.title}">${truncate(doc.title, 50)}</td>
                            <td><span class="badge badge-secondary">${doc.document_type}</span></td>
                            <td><span class="badge badge-info">${doc.document_scope}</span></td>
                            <td>${formatBytes(doc.content_length)}</td>
                            <td><span class="badge badge-warning">Old Embedding</span></td>
                            <td>
                                <button class="action-btn action-btn-primary" 
                                        onclick="reprocessDocument(${doc.id}, '${escapeQuotes(doc.title)}')">
                                    ♻️ Reprocess
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        renderPagination('emb-pagination', data.total, embeddingPage, (page) => {
            embeddingPage = page;
            loadEmbeddingDocuments();
        });
    } catch (error) {
        showAlert('Failed to load documents: ' + error.message, 'error');
    }
}

async function reprocessDocument(id, title) {
    if (!confirm(`Reprocess document: "${title}"?\n\nThis will delete the old embedding and create new chunks.`)) return;

    try {
        await apiCall(`/admin/embeddings/reprocess-document/${id}`, { method: 'POST' });
        showAlert(`Document queued for reprocessing: ${title}`, 'success');
        setTimeout(() => loadEmbeddings(), 2000);
    } catch (error) {
        showAlert('Failed to reprocess: ' + error.message, 'error');
    }
}

async function reprocessAll(limit = null) {
    const message = limit ? 
        `Reprocess ${limit} documents as a test?` : 
        'Reprocess ALL documents with old embeddings?\n\nThis may take several minutes.';
    
    if (!confirm(message)) return;

    try {
        const params = limit ? `?limit=${limit}` : '';
        const data = await apiCall(`/admin/embeddings/reprocess-all${params}`, { method: 'POST' });
        showAlert(`${data.count} documents queued for reprocessing`, 'success');
        setTimeout(() => loadEmbeddings(), 2000);
    } catch (error) {
        showAlert('Failed to start reprocessing: ' + error.message, 'error');
    }
}

// Users Tab
async function loadUsers() {
    try {
        const users = await apiCall('/admin/users?limit=100');
        const container = document.getElementById('users-container');

        // Update stats
        const activeCount = users.filter(u => u.is_active).length;
        const inactiveCount = users.length - activeCount;
        const superCount = users.filter(u => u.is_superuser).length;

        document.getElementById('user-total').textContent = users.length;
        document.getElementById('user-active').textContent = activeCount;
        document.getElementById('user-inactive').textContent = inactiveCount;
        document.getElementById('user-superuser').textContent = superCount;

        if (users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <h3>No Users</h3>
                    <p>Create your first user</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Roles</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>#${user.id}</td>
                            <td>${user.email}</td>
                            <td>${user.username}</td>
                            <td>
                                <span class="badge badge-${user.is_active ? 'success' : 'secondary'}">
                                    ${user.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                ${user.is_superuser ? '<span class="badge badge-danger">Admin</span>' : ''}
                                ${user.is_verified ? '<span class="badge badge-success">Verified</span>' : ''}
                            </td>
                            <td>${new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="action-btn action-btn-primary" 
                                        onclick="toggleUserActive(${user.id}, ${user.is_active})">
                                    ${user.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button class="action-btn action-btn-success" 
                                        onclick="resetPassword(${user.id}, '${user.email}')">
                                    Reset Password
                                </button>
                                <button class="action-btn action-btn-danger" 
                                        onclick="deleteUser(${user.id}, '${user.email}')">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        showAlert('Failed to load users: ' + error.message, 'error');
    }
}

async function showCreateUserModal() {
    document.getElementById('create-user-modal').classList.add('active');
}

async function createUser(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const data = {
        email: formData.get('email'),
        username: formData.get('username'),
        password: formData.get('password') || null,
        is_superuser: formData.get('is_superuser') === 'on'
    };

    try {
        const result = await apiCall('/admin/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        let message = `User created: ${result.user.email}`;
        if (result.temporary_password) {
            message += `\n\nTemporary Password: ${result.temporary_password}\n\n⚠️ Save this password! It won't be shown again.`;
            alert(message); // Use alert for password
        } else {
            showAlert(message, 'success');
        }

        closeModal('create-user-modal');
        form.reset();
        loadUsers();
    } catch (error) {
        showAlert('Failed to create user: ' + error.message, 'error');
    }
}

async function toggleUserActive(id, isActive) {
    try {
        await apiCall(`/admin/users/${id}/toggle-active`, { method: 'PATCH' });
        showAlert(`User ${isActive ? 'deactivated' : 'activated'}`, 'success');
        loadUsers();
    } catch (error) {
        showAlert('Failed to update user: ' + error.message, 'error');
    }
}

async function resetPassword(id, email) {
    if (!confirm(`Reset password for ${email}?`)) return;

    try {
        const result = await apiCall(`/admin/users/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        alert(`Password reset for ${email}\n\nNew Password: ${result.temporary_password}\n\n⚠️ Save this password!`);
        showAlert('Password reset successfully', 'success');
    } catch (error) {
        showAlert('Failed to reset password: ' + error.message, 'error');
    }
}

async function deleteUser(id, email) {
    if (!confirm(`Delete user: ${email}?\n\nThis will also delete all their conversations and data.`)) return;

    try {
        await apiCall(`/admin/users/${id}`, { method: 'DELETE' });
        showAlert(`User deleted: ${email}`, 'success');
        loadUsers();
    } catch (error) {
        showAlert('Failed to delete user: ' + error.message, 'error');
    }
}

// Utility Functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function changeAdminKey() {
    const newKey = prompt('Enter new admin key:');
    if (newKey) {
        adminKey = newKey;
        localStorage.setItem('admin_key', newKey);
        showAlert('Admin key updated', 'success');
        refreshAll();
    }
}

function refreshAll() {
    if (currentTab === 'overview') loadOverview();
    else if (currentTab === 'crawl') loadCrawlJobs();
    else if (currentTab === 'embeddings') loadEmbeddings();
    else if (currentTab === 'users') loadUsers();
}

function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function escapeQuotes(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function renderPagination(containerId, total, currentPage, onPageChange) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const container = document.getElementById(containerId);

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button ${currentPage === 0 ? 'disabled' : ''} 
                onclick="this.blur()">
            ← Previous
        </button>
    `;

    for (let i = 0; i < totalPages; i++) {
        if (i < 3 || i >= totalPages - 3 || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `
                <button class="${i === currentPage ? 'active' : ''}"
                        onclick="this.blur()">
                    ${i + 1}
                </button>
            `;
        } else if (i === 3 || i === totalPages - 4) {
            html += '<span style="padding: 8px;">...</span>';
        }
    }

    html += `
        <button ${currentPage === totalPages - 1 ? 'disabled' : ''}
                onclick="this.blur()">
            Next →
        </button>
    `;

    container.innerHTML = html;

    // Add event listeners
    const buttons = container.querySelectorAll('button:not([disabled])');
    buttons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            if (idx === 0) onPageChange(currentPage - 1);
            else if (idx === buttons.length - 1) onPageChange(currentPage + 1);
            else onPageChange(parseInt(btn.textContent) - 1);
        });
    });
}

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ==================== FEEDBACK MANAGEMENT ====================

async function loadFeedback() {
    const container = document.getElementById('feedback-container');
    const statusFilter = document.getElementById('feedback-status-filter')?.value || '';
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // Load stats
        const stats = await apiCall('/admin/feedback/stats');
        document.getElementById('feedback-total').textContent = stats.total || 0;
        document.getElementById('feedback-new').textContent = stats.new || 0;
        document.getElementById('feedback-in-progress').textContent = stats.in_progress || 0;
        document.getElementById('feedback-resolved').textContent = stats.resolved || 0;
        
        // Load feedback list
        let endpoint = '/admin/feedback';
        if (statusFilter !== 'all' && statusFilter !== '') {
            endpoint += `?status=${statusFilter}`;
        }
        
        const feedbackList = await apiCall(endpoint);
        
        if (!feedbackList || feedbackList.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No feedback found</p>';
            return;
        }
        
        // Create table
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        feedbackList.forEach(feedback => {
            const statusBadges = {
                'new': '<span class="badge badge-primary">🆕 New</span>',
                'in_progress': '<span class="badge badge-warning">🔄 In Progress</span>',
                'resolved': '<span class="badge badge-success">✅ Resolved</span>',
                'archived': '<span class="badge badge-secondary">📦 Archived</span>'
            };
            
            const messagePrev = feedback.message.length > 50 
                ? feedback.message.substring(0, 50) + '...' 
                : feedback.message;
            
            const createdDate = new Date(feedback.created_at).toLocaleString();
            
            html += `
                <tr>
                    <td>${feedback.id}</td>
                    <td>${escapeHtml(feedback.name)}</td>
                    <td>${escapeHtml(feedback.email)}</td>
                    <td>${feedback.company ? escapeHtml(feedback.company) : '-'}</td>
                    <td>${escapeHtml(messagePrev)}</td>
                    <td>${statusBadges[feedback.status] || feedback.status}</td>
                    <td>${createdDate}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="viewFeedbackDetails(${feedback.id})">
                            View
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFeedback(${feedback.id}, '${escapeHtml(feedback.email)}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading feedback:', error);
        container.innerHTML = `<p style="color: #e74c3c;">Error loading feedback: ${error.message}</p>`;
        showAlert('Failed to load feedback', 'error');
    }
}

async function viewFeedbackDetails(id) {
    try {
        const feedback = await apiCall(`/admin/feedback/${id}`);
        
        if (!feedback) {
            showAlert('Feedback not found', 'error');
            return;
        }
        
        // Populate modal
        document.getElementById('feedback-id').value = feedback.id;
        document.getElementById('feedback-name').value = feedback.name || '';
        document.getElementById('feedback-email').value = feedback.email || '';
        document.getElementById('feedback-company').value = feedback.company || '';
        document.getElementById('feedback-message').value = feedback.message || '';
        document.getElementById('feedback-status').value = feedback.status;
        document.getElementById('feedback-admin-notes').value = feedback.admin_notes || '';
        document.getElementById('feedback-created').value = new Date(feedback.created_at).toLocaleString();
        
        // Show/hide resolved date
        const resolvedGroup = document.getElementById('feedback-resolved-group');
        if (feedback.resolved_at) {
            document.getElementById('feedback-resolved').value = new Date(feedback.resolved_at).toLocaleString();
            resolvedGroup.style.display = 'block';
        } else {
            resolvedGroup.style.display = 'none';
        }
        
        // Show modal
        openModal('feedback-detail-modal');
        
    } catch (error) {
        console.error('Error loading feedback details:', error);
        showAlert('Failed to load feedback details', 'error');
    }
}

async function updateFeedbackDetails(event) {
    event.preventDefault();
    
    const form = event.target;
    const id = form.id.value;
    const status = form.status.value;
    const adminNotes = form.admin_notes.value;
    
    try {
        await apiCall(`/admin/feedback/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                status: status,
                admin_notes: adminNotes
            })
        });
        
        showAlert('Feedback updated successfully', 'success');
        closeModal('feedback-detail-modal');
        loadFeedback();
        
    } catch (error) {
        console.error('Error updating feedback:', error);
        showAlert('Failed to update feedback', 'error');
    }
}

async function deleteFeedback(id, email) {
    if (!confirm(`Are you sure you want to delete feedback from ${email}?`)) {
        return;
    }
    
    try {
        await apiCall(`/admin/feedback/${id}`, {
            method: 'DELETE'
        });
        
        showAlert('Feedback deleted successfully', 'success');
        loadFeedback();
        
    } catch (error) {
        console.error('Error deleting feedback:', error);
        showAlert('Failed to delete feedback', 'error');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
