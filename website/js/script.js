// ===== POWERNOVA WEBSITE JAVASCRIPT =====

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initNavigation();
    initScrollEffects();
    initContactForm();
    initAnimations();
    initHeroAnimation();
});

// ===== NAVIGATION =====
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Mobile menu toggle
    navToggle.addEventListener('click', function() {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close mobile menu when clicking on links
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 70; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Active link highlighting
    window.addEventListener('scroll', function() {
        let current = '';
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// ===== SCROLL EFFECTS =====
function initScrollEffects() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                
                // Add animation classes based on element position
                if (element.classList.contains('feature-card')) {
                    element.classList.add('animate-fade-in-up');
                } else if (element.classList.contains('tech-layer')) {
                    element.classList.add('animate-fade-in-up');
                } else if (element.classList.contains('market-card')) {
                    element.classList.add('animate-fade-in-up');
                }
                
                // Stop observing this element
                observer.unobserve(element);
            }
        });
    }, observerOptions);

    // Observe elements
    const animateElements = document.querySelectorAll('.feature-card, .tech-layer, .market-card');
    animateElements.forEach(element => {
        observer.observe(element);
    });
}

// ===== CONTACT FORM =====
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const formObject = {};
            formData.forEach((value, key) => {
                formObject[key] = value;
            });
            
            // Validate form
            if (validateForm(formObject)) {
                // Simulate form submission
                handleFormSubmission(formObject);
            }
        });
    }
}

function validateForm(data) {
    const { name, email, message } = data;
    
    // Basic validation
    if (!name.trim()) {
        showNotification('Please enter your name', 'error');
        return false;
    }
    
    if (!email.trim() || !isValidEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return false;
    }
    
    if (!message.trim()) {
        showNotification('Please enter your message', 'error');
        return false;
    }
    
    return true;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function handleFormSubmission(data) {
    // Show loading state
    const submitButton = document.querySelector('#contactForm button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitButton.disabled = true;

    // Send to backend API
    fetch('/api/contact/contact', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: data.name,
            email: data.email,
            company: data.company,
            message: data.message
        })
    })
    .then(async response => {
        const result = await response.json();
        if (response.ok && result.success) {
            document.getElementById('contactForm').reset();
            showNotification('Thank you! Your message has been sent successfully.', 'success');
        } else {
            showNotification(result.error || 'Failed to send message. Please try again.', 'error');
        }
    })
    .catch(() => {
        showNotification('Failed to send message. Please try again.', 'error');
    })
    .finally(() => {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        max-width: 400px;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#10B981';
        case 'error': return '#EF4444';
        case 'warning': return '#F59E0B';
        default: return '#3B82F6';
    }
}

// ===== ANIMATIONS =====
function initAnimations() {
    // Add staggered animation delays to feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Add staggered animation delays to tech layers
    const techLayers = document.querySelectorAll('.tech-layer');
    techLayers.forEach((layer, index) => {
        layer.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Add staggered animation delays to market cards
    const marketCards = document.querySelectorAll('.market-card');
    marketCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
}

// ===== HERO ANIMATION =====
function initHeroAnimation() {
    // Animate hero stats counting up
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const animateCount = (element, target, duration = 2000) => {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            // Format number based on content
            const text = element.textContent;
            if (text.includes('+')) {
                element.textContent = Math.floor(current).toLocaleString() + '+';
            } else if (text.includes('GW')) {
                element.textContent = Math.floor(current) + ' GW';
            } else if (text.includes('%')) {
                element.textContent = Math.floor(current) + '%';
            } else if (text === 'Real-time') {
                element.textContent = 'Real-time';
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    };
    
    // Intersection observer for hero stats
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const text = element.textContent;
                
                if (text.includes('13,761')) {
                    animateCount(element, 13761);
                } else if (text === '7') {
                    animateCount(element, 7);
                } else if (text.includes('156')) {
                    animateCount(element, 156);
                } else if (text.includes('23')) {
                    animateCount(element, 23);
                }
                
                heroObserver.unobserve(element);
            }
        });
    }, { threshold: 0.5 });
    
    statNumbers.forEach(stat => {
        heroObserver.observe(stat);
    });
}

// ===== UTILITY FUNCTIONS =====

// Smooth scroll to top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Debounce function for performance
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction() {
        const context = this;
        const args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Add scroll-to-top button
document.addEventListener('DOMContentLoaded', function() {
    // Create scroll to top button
    const scrollTopButton = document.createElement('button');
    scrollTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollTopButton.className = 'scroll-top-button';
    scrollTopButton.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        transition: all 0.3s ease;
        opacity: 0;
        visibility: hidden;
        z-index: 1000;
        font-size: 18px;
    `;
    
    document.body.appendChild(scrollTopButton);
    
    // Show/hide scroll to top button
    window.addEventListener('scroll', debounce(function() {
        if (window.scrollY > 300) {
            scrollTopButton.style.opacity = '1';
            scrollTopButton.style.visibility = 'visible';
        } else {
            scrollTopButton.style.opacity = '0';
            scrollTopButton.style.visibility = 'hidden';
        }
    }, 100));
    
    // Scroll to top functionality
    scrollTopButton.addEventListener('click', scrollToTop);
    
    // Hover effects
    scrollTopButton.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-3px)';
        this.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
    });
    
    scrollTopButton.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
    });
});

// ===== PERFORMANCE OPTIMIZATIONS =====

// Preload critical images
function preloadImages() {
    const images = [
        // Add any image URLs here when you add images to the site
    ];
    
    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// Initialize performance optimizations
document.addEventListener('DOMContentLoaded', function() {
    preloadImages();
    
    // Add loading class to body initially
    document.body.classList.add('loading');
    
    // Remove loading class when page is fully loaded
    window.addEventListener('load', function() {
        document.body.classList.remove('loading');
    });
});

// ===== ACCESSIBILITY IMPROVEMENTS =====

// Keyboard navigation support
document.addEventListener('keydown', function(e) {
    // ESC key closes mobile menu
    if (e.key === 'Escape') {
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');
        
        if (navMenu.classList.contains('active')) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        }
    }
});

// Focus management for mobile menu
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    navToggle.addEventListener('click', function() {
        // Focus first menu item when opening
        if (navMenu.classList.contains('active')) {
            setTimeout(() => {
                navLinks[0].focus();
            }, 100);
        }
    });
});

// ===== CONSOLE BRANDING =====
console.log(`
 ██████╗  ██████╗ ██╗    ██╗███████╗██████╗ ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ 
 ██╔══██╗██╔═══██╗██║    ██║██╔════╝██╔══██╗████╗  ██║██╔═══██╗██║   ██║██╔══██╗
 ██████╔╝██║   ██║██║ █╗ ██║█████╗  ██████╔╝██╔██╗ ██║██║   ██║██║   ██║███████║
 ██╔═══╝ ██║   ██║██║███╗██║██╔══╝  ██╔══██╗██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║
 ██║     ╚██████╔╝╚███╔███╔╝███████╗██║  ██║██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║
 ╚═╝      ╚═════╝  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝
                                                                                  
 Power Generation Intelligence Platform
 
 Interested in joining our team? Check out our careers page!
 Built with ❤️ and modern web technologies.
`);
