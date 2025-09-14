import React, { useState } from 'react';
import { LeadService } from '../services/leadService';
import SkipTraceModal from './SkipTraceModal';

interface SkipTraceButtonProps {
  leadId: string;
  onSkipTraceComplete?: (leadId: string, result: any) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SkipTraceButton: React.FC<SkipTraceButtonProps> = ({ 
  leadId, 
  onSkipTraceComplete, 
  size = 'md',
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Size classes
  const sizeClasses = {
    'sm': 'px-2 py-1 text-xs',
    'md': 'px-3 py-1.5 text-sm',
    'lg': 'px-4 py-2 text-base',
  };

  const handleSkipTrace = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await LeadService.skipTraceLead(leadId);
      
      if (onSkipTraceComplete) {
        onSkipTraceComplete(leadId, result);
      }
      
      // Open the modal to show results
      setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip trace lead');
      console.error('Skip trace error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div>
      <button
        onClick={handleSkipTrace}
        disabled={isLoading}
        className={`inline-flex items-center justify-center font-medium rounded-md 
          ${isLoading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'} 
          text-white ${sizeClasses[size]} ${className}`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Running...
          </>
        ) : (
          <>
            📱 Skip Trace
          </>
        )}
      </button>
      
      {error && (
        <div className="text-red-600 text-xs mt-1">{error}</div>
      )}
      
      {/* Results Modal */}
      <SkipTraceModal 
        leadId={leadId}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </div>
  );
};

export default SkipTraceButton;
