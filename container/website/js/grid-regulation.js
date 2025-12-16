// Grid Regulation Page Interactive Features

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all interactive features
    initSmoothScrolling();
    initScrollAnimations();
    initUseCaseTabs();
    initStickyTOC();
    initAnalytics();
});

/**
 * Smooth scrolling for table of contents links
 */
function initSmoothScrolling() {
    const tocLinks = document.querySelectorAll('.toc-list a');
    
    tocLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const headerOffset = 80; // Account for fixed header
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Update active state
                tocLinks.forEach(l => l.parentElement.classList.remove('active'));
                this.parentElement.classList.add('active');
            }
        });
    });
}

/**
 * Scroll-triggered animations using Intersection Observer
 */
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    // Create observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                
                // Animate children with delay if they exist
                const children = entry.target.querySelectorAll('.animate-child');
                children.forEach((child, index) => {
                    setTimeout(() => {
                        child.classList.add('is-visible');
                    }, index * 100);
                });
            }
        });
    }, observerOptions);
    
    // Observe elements
    const elementsToAnimate = document.querySelectorAll(`
        .content-section,
        .player-card,
        .timeline-item,
        .doc-type-card,
        .stakeholder-card,
        .feature-large,
        .stat-card,
        .cost-card,
        .coverage-card
    `);
    
    elementsToAnimate.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(element);
    });
    
    // Add CSS class when visible
    const style = document.createElement('style');
    style.textContent = `
        .is-visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Interactive use case tabs
 */
function initUseCaseTabs() {
    const tabs = document.querySelectorAll('.use-case-tab');
    
    // Initially show first tab
    if (tabs.length > 0) {
        tabs[0].classList.add('active');
    }
    
    tabs.forEach((tab, index) => {
        const header = tab.querySelector('h4');
        const content = tab.querySelector('.use-case-content');
        
        // Initially hide all content except first
        if (index !== 0) {
            content.style.display = 'none';
        }
        
        header.addEventListener('click', function() {
            const isActive = tab.classList.contains('active');
            
            // Close all tabs
            tabs.forEach(t => {
                t.classList.remove('active');
                const c = t.querySelector('.use-case-content');
                c.style.display = 'none';
            });
            
            // If wasn't active, open this one
            if (!isActive) {
                tab.classList.add('active');
                content.style.display = 'block';
                
                // Smooth scroll to tab if it's far down
                const tabTop = tab.getBoundingClientRect().top;
                if (tabTop < 100) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
}

/**
 * Sticky table of contents with active section highlighting
 */
function initStickyTOC() {
    const toc = document.querySelector('.toc-card');
    const sections = document.querySelectorAll('.content-section');
    const tocLinks = document.querySelectorAll('.toc-list a');
    
    if (!toc || sections.length === 0) return;
    
    // Update active section on scroll
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateActiveTOCLink();
                ticking = false;
            });
            ticking = true;
        }
    });
    
    function updateActiveTOCLink() {
        const scrollPosition = window.pageYOffset;
        
        sections.forEach((section, index) => {
            const sectionTop = section.offsetTop - 100;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                tocLinks.forEach(link => link.parentElement.classList.remove('active'));
                if (tocLinks[index]) {
                    tocLinks[index].parentElement.classList.add('active');
                }
            }
        });
    }
}

/**
 * Analytics tracking for CTA buttons
 */
function initAnalytics() {
    // Track CTA button clicks
    const ctaButtons = document.querySelectorAll('.btn-primary, .btn-secondary');
    
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const buttonText = this.textContent.trim();
            const buttonHref = this.getAttribute('href');
            
            // Track event if analytics is available
            if (typeof gtag !== 'undefined') {
                gtag('event', 'cta_click', {
                    'event_category': 'engagement',
                    'event_label': buttonText,
                    'value': buttonHref
                });
            }
            
            // Track with custom analytics if available
            if (typeof window.analytics !== 'undefined') {
                window.analytics.track('CTA Clicked', {
                    button: buttonText,
                    url: buttonHref,
                    page: 'grid-regulation'
                });
            }
        });
    });
    
    // Track scroll depth
    let scrollDepth = 0;
    const milestones = [25, 50, 75, 100];
    
    window.addEventListener('scroll', function() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.pageYOffset;
        const percentScrolled = Math.round((scrolled / documentHeight) * 100);
        
        milestones.forEach(milestone => {
            if (percentScrolled >= milestone && scrollDepth < milestone) {
                scrollDepth = milestone;
                
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'scroll_depth', {
                        'event_category': 'engagement',
                        'event_label': milestone + '%',
                        'value': milestone
                    });
                }
            }
        });
    });
    
    // Track time on page
    let startTime = Date.now();
    
    window.addEventListener('beforeunload', function() {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'time_on_page', {
                'event_category': 'engagement',
                'event_label': 'grid-regulation',
                'value': timeOnPage
            });
        }
    });
}

/**
 * Enhance formula component with hover effects
 */
function initFormulaInteraction() {
    const formulaComponents = document.querySelectorAll('.formula-component');
    
    formulaComponents.forEach(component => {
        component.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        component.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

/**
 * Add copy functionality to scenario steps
 */
function initCopyScenarios() {
    const scenarios = document.querySelectorAll('.scenario-box');
    
    scenarios.forEach(scenario => {
        const header = scenario.querySelector('.scenario-header');
        
        // Add copy button
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.className = 'scenario-copy-btn';
        copyBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            margin-left: auto;
            transition: all 0.3s ease;
        `;
        
        copyBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 255, 255, 0.3)';
        });
        
        copyBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, 0.2)';
        });
        
        copyBtn.addEventListener('click', function() {
            const content = scenario.querySelector('.scenario-content').innerText;
            const title = scenario.querySelector('.scenario-header h4').innerText;
            const fullText = `${title}\n\n${content}`;
            
            navigator.clipboard.writeText(fullText).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            });
        });
        
        header.appendChild(copyBtn);
    });
}

/**
 * Print functionality
 */
function initPrintButton() {
    // Add print button to the page
    const printBtn = document.createElement('button');
    printBtn.innerHTML = '<i class="fas fa-print"></i> Print Article';
    printBtn.className = 'print-btn';
    printBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 15px 25px;
        border-radius: 50px;
        cursor: pointer;
        font-weight: 600;
        box-shadow: 0 5px 20px rgba(59, 130, 246, 0.4);
        transition: all 0.3s ease;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    printBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-3px)';
        this.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.5)';
    });
    
    printBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 5px 20px rgba(59, 130, 246, 0.4)';
    });
    
    printBtn.addEventListener('click', function() {
        window.print();
    });
    
    document.body.appendChild(printBtn);
    
    // Hide print button when scrolling TOC into view
    const toc = document.querySelector('.toc-section');
    if (toc) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    printBtn.style.opacity = '0.5';
                } else {
                    printBtn.style.opacity = '1';
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(toc);
    }
}

/**
 * Back to top button
 */
function initBackToTop() {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.className = 'back-to-top-btn';
    backToTopBtn.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 30px;
        background: white;
        color: var(--primary-color);
        border: 2px solid var(--primary-color);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    backToTopBtn.addEventListener('mouseenter', function() {
        this.style.background = 'var(--primary-color)';
        this.style.color = 'white';
        this.style.transform = 'translateY(-3px)';
    });
    
    backToTopBtn.addEventListener('mouseleave', function() {
        this.style.background = 'white';
        this.style.color = 'var(--primary-color)';
        this.style.transform = 'translateY(0)';
    });
    
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    document.body.appendChild(backToTopBtn);
    
    // Show/hide based on scroll position
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 500) {
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.visibility = 'visible';
        } else {
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.visibility = 'hidden';
        }
    });
}

/**
 * Initialize progress indicator
 */
function initProgressIndicator() {
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 4px;
        background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
        width: 0%;
        z-index: 10000;
        transition: width 0.1s ease;
    `;
    
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', function() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.pageYOffset;
        const progress = (scrolled / documentHeight) * 100;
        
        progressBar.style.width = progress + '%';
    });
}

// Initialize additional features
document.addEventListener('DOMContentLoaded', function() {
    initFormulaInteraction();
    initCopyScenarios();
    initPrintButton();
    initBackToTop();
    initProgressIndicator();
});

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSmoothScrolling,
        initScrollAnimations,
        initUseCaseTabs,
        initStickyTOC,
        initAnalytics
    };
}
