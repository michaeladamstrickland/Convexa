import React from 'react';

type TemperatureTagType = 'DEAD' | 'WARM' | 'HOT' | 'ON_FIRE';

interface TemperatureBadgeProps {
  temperature: TemperatureTagType;
  size?: 'sm' | 'md' | 'lg';
}

const TemperatureBadge: React.FC<TemperatureBadgeProps> = ({ temperature, size = 'md' }) => {
  // Define color schemes for each temperature
  const colorSchemes = {
    'DEAD': 'bg-gray-500 text-white',
    'WARM': 'bg-yellow-500 text-white',
    'HOT': 'bg-orange-500 text-white',
    'ON_FIRE': 'bg-red-600 text-white',
  };
  
  // Define size classes
  const sizeClasses = {
    'sm': 'px-1.5 py-0.5 text-xs',
    'md': 'px-2.5 py-1 text-sm',
    'lg': 'px-3 py-1.5 text-base',
  };
  
  // Format the temperature label
  const formatLabel = (temp: string): string => {
    return temp.replace('_', ' ');
  };

  return (
    <span 
      className={`inline-flex items-center rounded-full font-medium ${colorSchemes[temperature]} ${sizeClasses[size]}`}
    >
      {formatLabel(temperature)}
    </span>
  );
};

export default TemperatureBadge;
