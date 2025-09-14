import React, { useState, useEffect } from 'react';
import { LeadService } from '../services/leadService';

interface SkipTraceModalProps {
  leadId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SkipTraceResult {
  success: boolean;
  confidence: number;
  data: {
    phones?: Array<{
      number: string;
      type: string;
      carrier?: string;
      isValid: boolean;
    }>;
    emails?: Array<{
      address: string;
      type: string;
      isValid: boolean;
    }>;
    addresses?: Array<{
      street: string;
      city: string;
      state: string;
      zipCode: string;
      type: string;
    }>;
    relatives?: Array<{
      name: string;
      relationship?: string;
    }>;
  };
  cost: number;
  provider: string;
}

const SkipTraceModal: React.FC<SkipTraceModalProps> = ({ leadId, isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkipTraceResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  // Load skip trace history when modal opens
  useEffect(() => {
    if (isOpen && leadId) {
      loadSkipTraceHistory();
    }
  }, [isOpen, leadId]);
  
  const loadSkipTraceHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await LeadService.getSkipTraceHistory(leadId);
      if (response.success) {
        setHistory(response.history || []);
        
        // If there's history, show the most recent result
        if (response.history && response.history.length > 0) {
          const mostRecent = response.history[0];
          setResult(JSON.parse(mostRecent.responseData));
        }
      }
    } catch (error) {
      setError('Failed to load skip trace history');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const runSkipTrace = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await LeadService.skipTraceLead(leadId);
      if (response.success) {
        setResult(response.result);
        // Reload history
        loadSkipTraceHistory();
      } else {
        setError(response.message || 'Skip trace failed');
      }
    } catch (error) {
      setError('Error running skip trace');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // If modal is closed, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Skip Trace Results</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error ? (
            <div className="text-red-500 py-4">{error}</div>
          ) : result ? (
            <div>
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Provider:</span>
                  <span className="capitalize">{result.provider.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Confidence Score:</span>
                  <span>{result.confidence}%</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Cost:</span>
                  <span>${result.cost.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Phone numbers */}
              <div className="mb-4">
                <h4 className="font-semibold text-lg mb-2">Phone Numbers</h4>
                {result.data.phones && result.data.phones.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {result.data.phones.map((phone, index) => (
                      <li key={index} className="py-2">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="font-medium">{phone.number}</div>
                            <div className="text-sm text-gray-500">
                              {phone.type} {phone.carrier ? `• ${phone.carrier}` : ''}
                            </div>
                          </div>
                          <div>
                            <a 
                              href={`tel:${phone.number}`} 
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                            >
                              Call
                            </a>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No phone numbers found</p>
                )}
              </div>
              
              {/* Email addresses */}
              <div className="mb-4">
                <h4 className="font-semibold text-lg mb-2">Email Addresses</h4>
                {result.data.emails && result.data.emails.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {result.data.emails.map((email, index) => (
                      <li key={index} className="py-2">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="font-medium">{email.address}</div>
                            <div className="text-sm text-gray-500">
                              {email.type} {email.isValid ? '• Valid' : '• Invalid'}
                            </div>
                          </div>
                          <div>
                            <a 
                              href={`mailto:${email.address}`} 
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                              Email
                            </a>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No email addresses found</p>
                )}
              </div>
              
              {/* Addresses */}
              {result.data.addresses && result.data.addresses.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-lg mb-2">Addresses</h4>
                  <ul className="divide-y divide-gray-200">
                    {result.data.addresses.map((address, index) => (
                      <li key={index} className="py-2">
                        <div className="font-medium">
                          {address.street}
                        </div>
                        <div className="text-sm">
                          {address.city}, {address.state} {address.zipCode}
                        </div>
                        <div className="text-sm text-gray-500">
                          {address.type}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Relatives */}
              {result.data.relatives && result.data.relatives.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-lg mb-2">Relatives</h4>
                  <ul className="divide-y divide-gray-200">
                    {result.data.relatives.map((relative, index) => (
                      <li key={index} className="py-2">
                        <div className="font-medium">{relative.name}</div>
                        {relative.relationship && (
                          <div className="text-sm text-gray-500">{relative.relationship}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                No skip trace results available for this lead.
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
          >
            Close
          </button>
          
          <button
            onClick={runSkipTrace}
            disabled={loading}
            className={`px-4 py-2 ${
              loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
            } text-white rounded-md`}
          >
            {loading ? 'Running...' : 'Run Skip Trace'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkipTraceModal;
