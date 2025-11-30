/**
 * PowerNOVA Search Module
 * Handles semantic search functionality and result display
 */

// Configuration
const API_URL = window.PowerNOVA?.config?.apiUrl || 'http://localhost:8000';
const RESULTS_PER_PAGE = 20;

// State
let currentQuery = '';
let currentPage = 1;
let totalPages = 1;
let isSearching = false;

/**
 * Initialize search page
 */
function initSearchPage() {
    console.log('Initializing search page...');
    
    // Get query from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const page = parseInt(urlParams.get('page')) || 1;
    
    if (query) {
        currentQuery = query;
        currentPage = page;
        
        // Set search input value
        const searchInput = document.getElementById('searchPageInput');
        if (searchInput) {
            searchInput.value = query;
        }
        
        // Perform search
        performSearch(query, page);
    } else {
        // Show initial empty state
        showEmptyInitial();
    }
    
    // Setup event listeners
    setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Search form submit
    const searchForm = document.getElementById('searchPageForm');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearchSubmit);
    }
    
    // Suggestion chips
    const suggestionChips = document.querySelectorAll('.suggestion-chip');
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const query = chip.dataset.query;
            if (query) {
                currentQuery = query;
                currentPage = 1;
                
                // Update input
                const searchInput = document.getElementById('searchPageInput');
                if (searchInput) {
                    searchInput.value = query;
                }
                
                // Update URL and search
                updateURL(query, 1);
                performSearch(query, 1);
            }
        });
    });
    
    // Pagination buttons
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateURL(currentQuery, currentPage);
                performSearch(currentQuery, currentPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                updateURL(currentQuery, currentPage);
                performSearch(currentQuery, currentPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
}

/**
 * Handle search form submission
 */
function handleSearchSubmit(event) {
    event.preventDefault();
    
    const searchInput = document.getElementById('searchPageInput');
    const query = searchInput.value.trim();
    
    if (query) {
        currentQuery = query;
        currentPage = 1;
        updateURL(query, 1);
        performSearch(query, 1);
    }
}

/**
 * Perform search API call
 */
async function performSearch(query, page = 1) {
    if (isSearching) {
        console.log('Search already in progress');
        return;
    }
    
    isSearching = true;
    showLoading();
    
    try {
        const response = await fetch(
            `${API_URL}/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=${RESULTS_PER_PAGE}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update state
        totalPages = data.pages;
        currentPage = data.page;
        
        // Track search analytics
        if (window.trackSearch) {
            window.trackSearch(query, data.total);
        }
        
        // Display results
        displayResults(data);
        
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message);
    } finally {
        isSearching = false;
    }
}

/**
 * Display search results
 */
function displayResults(data) {
    // Hide all states
    hideAllStates();
    
    if (data.results.length === 0) {
        showEmptyResults();
        return;
    }
    
    // Show search info
    const searchInfo = document.getElementById('searchInfo');
    if (searchInfo) {
        searchInfo.style.display = 'flex';
        
        const queryEl = searchInfo.querySelector('.search-query strong');
        const countEl = searchInfo.querySelector('.search-count span');
        const timeEl = searchInfo.querySelector('.search-count');
        
        if (queryEl) queryEl.textContent = `"${data.query}"`;
        if (countEl) countEl.textContent = data.total.toLocaleString();
        if (timeEl) {
            const timeText = timeEl.textContent.split('in')[0];
            timeEl.innerHTML = `${countEl.outerHTML} documents found in <strong>${data.search_time_ms}ms</strong>`;
        }
    }
    
    // Render results
    const resultsList = document.getElementById('searchResultsList');
    if (resultsList) {
        resultsList.style.display = 'flex';
        resultsList.innerHTML = '';
        
        data.results.forEach(result => {
            const card = createResultCard(result);
            resultsList.appendChild(card);
        });
    }
    
    // Update pagination
    updatePagination(data.page, data.pages);
}

/**
 * Create result card element
 */
function createResultCard(result) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    // Determine icon based on document type
    const iconMap = {
        'PDF': 'fa-file-pdf',
        'HTML': 'fa-file-code',
        'DOCX': 'fa-file-word',
        'TXT': 'fa-file-text',
        'XLSX': 'fa-file-excel',
        'PPTX': 'fa-file-powerpoint'
    };
    
    const docType = result.document_type.toUpperCase();
    const icon = iconMap[docType] || 'fa-file';
    
    // Format similarity score as percentage
    const scorePercent = Math.round(result.similarity_score * 100);
    let scoreClass = 'medium';
    if (scorePercent >= 80) scoreClass = 'high';
    
    // Highlight query terms in snippet
    const highlightedSnippet = highlightText(result.snippet, currentQuery);
    
    card.innerHTML = `
        <div class="result-header">
            <div class="result-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="result-content">
                <h3 class="result-title">
                    <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">
                        ${escapeHtml(result.title)}
                    </a>
                </h3>
                <div class="result-url">${escapeHtml(result.url)}</div>
                <p class="result-snippet">${highlightedSnippet}</p>
                <div class="result-metadata">
                    <span class="result-meta-item">
                        <i class="fas fa-file"></i>
                        ${docType}
                    </span>
                    ${result.source ? `
                        <span class="result-meta-item">
                            <i class="fas fa-building"></i>
                            ${escapeHtml(result.source)}
                        </span>
                    ` : ''}
                    <span class="result-score ${scoreClass}">
                        ${scorePercent}% match
                    </span>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * Highlight query terms in text
 */
function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);
    
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let highlighted = escapeHtml(text);
    
    terms.forEach(term => {
        const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
}

/**
 * Update pagination controls
 */
function updatePagination(currentPage, totalPages) {
    const pagination = document.getElementById('searchPagination');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    
    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
}

/**
 * Update URL with search parameters
 */
function updateURL(query, page) {
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    
    if (page > 1) {
        url.searchParams.set('page', page);
    } else {
        url.searchParams.delete('page');
    }
    
    window.history.pushState({}, '', url);
}

/**
 * Show loading state
 */
function showLoading() {
    hideAllStates();
    const loading = document.getElementById('searchLoading');
    if (loading) {
        loading.style.display = 'block';
    }
}

/**
 * Show empty initial state
 */
function showEmptyInitial() {
    hideAllStates();
    const emptyInitial = document.getElementById('searchEmptyInitial');
    if (emptyInitial) {
        emptyInitial.style.display = 'block';
    }
}

/**
 * Show empty results state
 */
function showEmptyResults() {
    hideAllStates();
    const emptyResults = document.getElementById('searchEmptyResults');
    if (emptyResults) {
        emptyResults.style.display = 'block';
    }
}

/**
 * Show error message
 */
function showError(message) {
    hideAllStates();
    const emptyResults = document.getElementById('searchEmptyResults');
    if (emptyResults) {
        emptyResults.style.display = 'block';
        
        // Update message
        const heading = emptyResults.querySelector('h2');
        const paragraph = emptyResults.querySelector('p');
        
        if (heading) heading.textContent = 'Search Error';
        if (paragraph) paragraph.textContent = message || 'An error occurred while searching. Please try again.';
    }
}

/**
 * Hide all state elements
 */
function hideAllStates() {
    const states = [
        'searchInfo',
        'searchLoading',
        'searchEmptyInitial',
        'searchEmptyResults',
        'searchResultsList',
        'searchPagination'
    ];
    
    states.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
        }
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape regex special characters
 */
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearchPage);
} else {
    initSearchPage();
}
