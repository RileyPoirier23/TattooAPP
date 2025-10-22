// @/components/shared/Loader.tsx
import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white';
}

/**
 * A consistent, configurable loading spinner.
 */
export const Loader: React.FC<LoaderProps> = ({ size = 'md', color = 'primary' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-16 h-16 border-4',
  }[size];

  const colorClasses = color === 'primary' 
    ? 'border-brand-primary border-t-transparent'
    : 'border-white border-t-transparent';

  return (
    <div 
      className={`${sizeClasses} ${colorClasses} rounded-full animate-spin`} 
      role="status" 
      aria-label="Loading..."
    ></div>
  );
};
