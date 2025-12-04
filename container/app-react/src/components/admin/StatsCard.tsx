import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  label?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export function StatsCard({ 
  title, 
  value, 
  label, 
  icon, 
  trend,
  className = '',
  onClick 
}: StatsCardProps) {
  const baseClasses = "bg-white rounded-lg shadow-sm border border-gray-200 p-6";
  const interactiveClasses = onClick ? "cursor-pointer hover:shadow-md transition-shadow" : "";

  return (
    <div 
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        {trend && (
          <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      
      {label && (
        <div className="mt-1 text-sm text-gray-500">{label}</div>
      )}
    </div>
  );
}
