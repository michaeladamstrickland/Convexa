import { FC } from 'react';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizes = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const sizeClass = sizes[size];

  return (
    <div className={`inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent ${sizeClass} ${className}`} role="status">
      <span className="sr-only">Loading...</span>
    </div>
  );
};
