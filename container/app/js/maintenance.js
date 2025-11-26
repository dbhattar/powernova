// ==========================================
// PowerNOVA Maintenance Mode Module
// ==========================================

const MaintenanceMode = {
    checkInterval: null,
    pollIntervalMs: 30000, // Check every 30 seconds
    
    /**
     * Check if the application is in maintenance mode
     * @returns {Promise<Object>} Maintenance status response
     */
    async checkStatus() {
        try {
            const apiUrl = window.PowerNOVA?.getApiUrl() || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/maintenance/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Don't send credentials for maintenance check
                credentials: 'omit'
            });
            
            if (!response.ok) {
                console.error('Failed to check maintenance status:', response.status);
                return { maintenance: false, message: 'Unable to check maintenance status' };
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking maintenance status:', error);
            return { maintenance: false, message: 'Unable to check maintenance status' };
        }
    },
    
    /**
     * Show the maintenance mode UI
     * @param {string} message - The maintenance message to display
     * @param {string} estimatedDuration - Estimated duration of maintenance
     */
    showMaintenanceUI(message, estimatedDuration) {
        // Hide the main app content
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.display = 'none';
        }
        
        // Show maintenance UI
        let maintenanceContainer = document.getElementById('maintenance-container');
        
        if (!maintenanceContainer) {
            // Create maintenance container if it doesn't exist
            maintenanceContainer = document.createElement('div');
            maintenanceContainer.id = 'maintenance-container';
            maintenanceContainer.className = 'maintenance-container';
            document.body.appendChild(maintenanceContainer);
        }
        
        maintenanceContainer.innerHTML = `
            <div class="maintenance-content">
                <div class="maintenance-icon">
                    <i class="fas fa-tools"></i>
                </div>
                <h1 class="maintenance-title">We'll Be Right Back!</h1>
                <p class="maintenance-message">${message}</p>
                ${estimatedDuration ? `<p class="maintenance-duration">Estimated Duration: ${estimatedDuration}</p>` : ''}
                <div class="maintenance-spinner">
                    <div class="spinner"></div>
                    <p class="maintenance-status">Checking status...</p>
                </div>
                <p class="maintenance-footer">
                    This page will automatically refresh when maintenance is complete.
                </p>
            </div>
        `;
        
        maintenanceContainer.style.display = 'flex';
        
        console.log('Maintenance mode UI displayed');
    },
    
    /**
     * Hide the maintenance mode UI and show the app
     */
    hideMaintenanceUI() {
        const maintenanceContainer = document.getElementById('maintenance-container');
        if (maintenanceContainer) {
            maintenanceContainer.style.display = 'none';
        }
        
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.display = 'block';
        }
        
        console.log('Maintenance mode UI hidden, app restored');
    },
    
    /**
     * Start polling maintenance status
     */
    startPolling() {
        // Clear any existing interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        // Poll every 30 seconds
        this.checkInterval = setInterval(async () => {
            const status = await this.checkStatus();
            
            if (!status.maintenance) {
                // Maintenance is over, reload the page
                console.log('Maintenance mode ended, reloading page...');
                this.stopPolling();
                window.location.reload();
            } else {
                console.log('Still in maintenance mode, next check in 30 seconds');
            }
        }, this.pollIntervalMs);
        
        console.log('Started polling maintenance status every 30 seconds');
    },
    
    /**
     * Stop polling maintenance status
     */
    stopPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('Stopped polling maintenance status');
        }
    },
    
    /**
     * Initialize maintenance mode check
     * Should be called before initializing the main app
     * @returns {Promise<boolean>} true if maintenance mode is active, false otherwise
     */
    async init() {
        console.log('Checking maintenance status...');
        
        const status = await this.checkStatus();
        
        if (status.maintenance) {
            console.log('Application is in maintenance mode');
            this.showMaintenanceUI(
                status.message || 'PowerNOVA is currently undergoing scheduled maintenance.',
                status.estimated_duration
            );
            this.startPolling();
            return true;
        } else {
            console.log('Application is not in maintenance mode');
            this.hideMaintenanceUI();
            return false;
        }
    }
};

// Make available globally
window.PowerNOVA = window.PowerNOVA || {};
window.PowerNOVA.MaintenanceMode = MaintenanceMode;
