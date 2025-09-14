import React, { useState } from 'react';
import { LeadService } from '../services/leadService';

interface FeedbackButtonsProps {
  leadId: string;
  onFeedbackSubmitted?: (leadId: string, label: 'good' | 'bad', updatedLead: any) => void;
}

const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({ leadId, onFeedbackSubmitted }) => {
  const [submitting, setSubmitting] = useState<'good' | 'bad' | null>(null);

  const handleFeedback = async (label: 'good' | 'bad') => {
    setSubmitting(label);
    try {
      const response = await LeadService.submitFeedback(leadId, label);
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(leadId, label, response.lead);
      }
    } catch (error) {
      console.error(`Error submitting ${label} feedback:`, error);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex space-x-2">
      <button
        onClick={() => handleFeedback('good')}
        disabled={submitting === 'good'}
        className={`inline-flex items-center px-2 py-1 text-sm font-medium rounded-md ${
          submitting === 'good'
            ? 'bg-green-100 text-green-500 cursor-wait'
            : 'bg-green-50 text-green-600 hover:bg-green-100'
        }`}
      >
        {submitting === 'good' ? (
          <>
            <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </>
        ) : (
          <>
            👍 Good Lead
          </>
        )}
      </button>

      <button
        onClick={() => handleFeedback('bad')}
        disabled={submitting === 'bad'}
        className={`inline-flex items-center px-2 py-1 text-sm font-medium rounded-md ${
          submitting === 'bad'
            ? 'bg-red-100 text-red-500 cursor-wait'
            : 'bg-red-50 text-red-600 hover:bg-red-100'
        }`}
      >
        {submitting === 'bad' ? (
          <>
            <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </>
        ) : (
          <>
            👎 Dead Lead
          </>
        )}
      </button>
    </div>
  );
};

export default FeedbackButtons;
