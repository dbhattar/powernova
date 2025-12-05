import React from 'react';

interface ProcessingStatusProps {
  status: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ 
  status, 
  size = 'sm' 
}) => {
  if (!status || status === 'completed') {
    return null; // Don't show anything if completed or no status
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const getStatusDisplay = () => {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          icon: '⏱️',
          text: 'Queued',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-300'
        };
      case 'processing':
        return {
          icon: (
            <svg 
              className="animate-spin h-3 w-3 inline-block mr-1" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ),
          text: 'Processing',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-300'
        };
      case 'failed':
        return {
          icon: '❌',
          text: 'Failed',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-300'
        };
      default:
        return null;
    }
  };

  const displayInfo = getStatusDisplay();
  
  if (!displayInfo) {
    return null;
  }

  return (
    <span 
      className={`
        inline-flex items-center rounded-full border
        ${sizeClasses[size]}
        ${displayInfo.bgColor}
        ${displayInfo.textColor}
        ${displayInfo.borderColor}
        font-medium
      `}
      title={`Document is ${status}`}
    >
      {displayInfo.icon}{' '}
      {displayInfo.text}
    </span>
  );
};
