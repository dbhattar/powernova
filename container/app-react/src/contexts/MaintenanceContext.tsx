import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface MaintenanceStatus {
  maintenance: boolean;
  message: string;
  estimated_duration?: string;
}

interface MaintenanceContextType {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  estimatedDuration?: string;
  isChecking: boolean;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 30000; // Check every 30 seconds

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState<string | undefined>();
  const [isChecking, setIsChecking] = useState(true);

  const checkMaintenanceStatus = async (): Promise<MaintenanceStatus> => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/maintenance/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'omit', // Don't send credentials for maintenance check
      });

      if (!response.ok) {
        console.error('Failed to check maintenance status:', response.status);
        return { 
          maintenance: false, 
          message: 'Unable to check maintenance status' 
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking maintenance status:', error);
      return { 
        maintenance: false, 
        message: 'Unable to check maintenance status' 
      };
    }
  };

  useEffect(() => {
    let pollInterval: number | null = null;

    const init = async () => {
      console.log('Checking maintenance status...');
      const status = await checkMaintenanceStatus();
      
      setIsMaintenanceMode(status.maintenance);
      setMaintenanceMessage(status.message);
      setEstimatedDuration(status.estimated_duration);
      setIsChecking(false);

      if (status.maintenance) {
        console.log('Application is in maintenance mode');
        
        // Start polling to check when maintenance is over
        pollInterval = setInterval(async () => {
          console.log('Polling maintenance status...');
          const pollStatus = await checkMaintenanceStatus();
          
          if (!pollStatus.maintenance) {
            console.log('Maintenance mode ended, reloading page...');
            window.location.reload();
          } else {
            console.log('Still in maintenance mode, next check in 30 seconds');
          }
        }, POLL_INTERVAL_MS);
      } else {
        console.log('Application is not in maintenance mode');
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  return (
    <MaintenanceContext.Provider
      value={{
        isMaintenanceMode,
        maintenanceMessage,
        estimatedDuration,
        isChecking,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (context === undefined) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
}
