import { useState, useEffect } from 'react';
import searchService, { Lead, SearchParams } from '../services/searchService';
import TemperatureBadge from './TemperatureBadge';
import FeedbackButtons from './FeedbackButtons';
import SkipTraceButton from './SkipTraceButton';

// Status to color mapping
const statusColors: Record<string, string> = {
  NEW: 'bg-blue-500',
  CONTACTED: 'bg-purple-500',
  NEGOTIATING: 'bg-amber-500',
  UNDER_CONTRACT: 'bg-emerald-500',
  CLOSED: 'bg-green-600',
  DEAD: 'bg-gray-500',
};

const LeadSearch: React.FC = () => {
  const [searchParams, setSearchParams] = useState<SearchParams>({
    limit: 10,
    page: 1,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);

  // Load leads on initial render and when search params change
  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const response = await searchService.searchLeads(searchParams);
        setLeads(response.leads);
        setTotalLeads(response.pagination.total);
        setTotalPages(response.pagination.pages);
      } catch (err) {
        setError('Failed to fetch leads');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [searchParams]);

  // Load analytics
  const loadAnalytics = async () => {
    try {
      const response = await searchService.getAnalytics();
      setAnalytics(response.analytics);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  // Clear cache
  const clearCache = async () => {
    try {
      await searchService.clearCache();
      // Reload leads and analytics
      const searchResponse = await searchService.searchLeads(searchParams);
      setLeads(searchResponse.leads);
      setTotalLeads(searchResponse.pagination.total);
      setTotalPages(searchResponse.pagination.pages);
      
      if (analytics) {
        loadAnalytics();
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  };

  // Handle form change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // Convert number inputs to numbers
    if (type === 'number') {
      setSearchParams({
        ...searchParams,
        [name]: value ? parseInt(value) : undefined,
      });
    } else {
      setSearchParams({
        ...searchParams,
        [name]: value,
      });
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Reset to page 1 when searching
    setSearchParams({
      ...searchParams,
      page: 1,
    });
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setSearchParams({
      ...searchParams,
      page,
    });
  };

  // Toggle analytics
  const toggleAnalytics = () => {
    if (!analytics && !showAnalytics) {
      loadAnalytics();
    }
    setShowAnalytics(!showAnalytics);
  };
  
  // Refresh lead data
  const refreshLeads = async () => {
    setLoading(true);
    try {
      const response = await searchService.searchLeads(searchParams);
      setLeads(response.leads);
      setTotalLeads(response.pagination.total);
      setTotalPages(response.pagination.pages);
    } catch (err) {
      setError('Failed to refresh leads');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle feedback submission
  const handleFeedbackSubmitted = (leadId: string, label: 'good' | 'bad', updatedLead: any) => {
    // Update the lead in the leads array
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId ? { ...lead, ...updatedLead } : lead
      )
    );
    
    // Refresh the lead data to get updated temperatures and scores
    setTimeout(() => {
      refreshLeads();
    }, 1000); // Give the backend a moment to update scores
    
    // Show toast or notification here if needed
    console.log(`Feedback ${label} submitted for lead ${leadId}`);
  };

  // Handle skip trace completion
  const handleSkipTraceComplete = (leadId: string, result: any) => {
    // Update the lead in the leads array with new contact info
    if (result && result.success) {
      const updatedLead = result.lead || {};
      
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId ? { 
            ...lead,
            phone: updatedLead.phone || lead.phone,
            email: updatedLead.email || lead.email,
            phones: updatedLead.phones || lead.phones,
            emails: updatedLead.emails || lead.emails
          } : lead
        )
      );
      
      // Refresh all leads
      setTimeout(() => {
        refreshLeads();
      }, 1000);
      
      console.log(`Skip trace completed for lead ${leadId}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Unified Lead Search</h1>
      
      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-3">
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              id="query"
              name="query"
              value={searchParams.query || ''}
              onChange={handleInputChange}
              placeholder="Search by address or owner name"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="minValue" className="block text-sm font-medium text-gray-700 mb-1">
              Min Value ($)
            </label>
            <input
              type="number"
              id="minValue"
              name="minValue"
              value={searchParams.minValue || ''}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="maxValue" className="block text-sm font-medium text-gray-700 mb-1">
              Max Value ($)
            </label>
            <input
              type="number"
              id="maxValue"
              name="maxValue"
              value={searchParams.maxValue || ''}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
              ZIP Code
            </label>
            <input
              type="text"
              id="zipCode"
              name="zipCode"
              value={searchParams.zipCode || ''}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
              Source
            </label>
            <select
              id="source"
              name="source"
              value={searchParams.source || ''}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">All Sources</option>
              <option value="probate">Probate</option>
              <option value="violation">Code Violations</option>
              <option value="tax_lien">Tax Liens</option>
              <option value="foreclosure">Foreclosure</option>
              <option value="divorce">Divorce</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
              Temperature
            </label>
            <select
              id="temperature"
              name="temperature"
              value={searchParams.temperature || ''}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">All Temperatures</option>
              <option value="ON_FIRE">On Fire</option>
              <option value="HOT">Hot</option>
              <option value="WARM">Warm</option>
              <option value="COLD">Cold</option>
              <option value="DEAD">Dead</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={searchParams.status || ''}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="NEGOTIATING">Negotiating</option>
              <option value="UNDER_CONTRACT">Under Contract</option>
              <option value="CLOSED">Closed</option>
              <option value="DEAD">Dead</option>
            </select>
          </div>
          
          <div className="col-span-3 flex justify-between items-center mt-4">
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
              >
                Search
              </button>
              
              <button
                type="button"
                onClick={() => setSearchParams({
                  limit: 10,
                  page: 1,
                  sortBy: 'created_at',
                  sortOrder: 'desc',
                })}
                className="px-4 py-2 bg-gray-500 text-white font-medium rounded-md hover:bg-gray-600"
              >
                Reset
              </button>
              
              <button
                type="button"
                onClick={clearCache}
                className="px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700"
              >
                Clear Cache
              </button>
            </div>
            
            <button
              type="button"
              onClick={toggleAnalytics}
              className="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700"
            >
              {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Analytics */}
      {showAnalytics && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Lead Analytics</h2>
          
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-blue-800">Total Leads</h3>
                <p className="text-3xl font-bold">{analytics.totalLeads}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-green-800">Total Value</h3>
                <p className="text-3xl font-bold">${analytics.totalEstimatedValue?.toLocaleString()}</p>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-amber-800">Avg Motivation</h3>
                <p className="text-3xl font-bold">{analytics.avgMotivationScore?.toFixed(1)}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-purple-800">Potential Revenue</h3>
                <p className="text-3xl font-bold">${analytics.potentialRevenue?.toLocaleString()}</p>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <h3 className="text-lg font-medium mb-2">Lead Sources</h3>
                <div className="space-y-2">
                  {analytics.leadsBySource?.map((source: any) => (
                    <div key={source.source} className="flex justify-between">
                      <span className="capitalize">{source.source?.replace('_', ' ')}</span>
                      <span className="font-medium">{source.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <h3 className="text-lg font-medium mb-2">Temperature Distribution</h3>
                <div className="space-y-2">
                  {analytics.temperatureDistribution?.map((temp: any) => (
                    <div key={temp.tag} className="flex justify-between">
                      <span className="capitalize">{temp.tag?.toLowerCase().replace('_', ' ')}</span>
                      <span className="font-medium">{temp.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      )}
      
      {/* Results */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Search Results</h2>
          <span className="text-gray-600">
            {totalLeads} lead{totalLeads !== 1 ? 's' : ''} found
          </span>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 text-red-700 p-4 rounded-md">
            {error}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No leads found matching your criteria
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value / Equity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temperature
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feedback
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{lead.propertyAddress}</div>
                          <div className="text-sm text-gray-500">{lead.ownerName || 'Unknown Owner'}</div>
                          {lead.phone && <div className="text-xs text-gray-500">{lead.phone}</div>}
                          <div className="mt-2">
                            <SkipTraceButton 
                              leadId={lead.id} 
                              size="sm" 
                              onSkipTraceComplete={handleSkipTraceComplete} 
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        ${lead.estimatedValue?.toLocaleString() || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Equity: ${lead.equity?.toLocaleString() || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {lead.temperatureTag ? (
                          <TemperatureBadge temperature={lead.temperatureTag as any} size="sm" />
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white bg-gray-500">
                            Unknown
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${
                            statusColors[lead.status as keyof typeof statusColors] || 'bg-gray-500'
                          }`}
                        >
                          {lead.status || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="capitalize">
                        {lead.source?.replace('_', ' ') || lead.sourceType?.replace('_', ' ') || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="mr-2">
                          <div className="text-sm font-medium text-gray-900">{lead.motivationScore || 0}</div>
                          <div className="text-xs text-gray-500">AI: {lead.aiScore || 0}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <FeedbackButtons 
                        leadId={lead.id}
                        onFeedbackSubmitted={handleFeedbackSubmitted}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => handlePageChange(searchParams.page! - 1)}
              disabled={searchParams.page === 1}
              className={`px-4 py-2 border rounded-md ${
                searchParams.page === 1
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            
            <div className="text-sm text-gray-700">
              Page {searchParams.page} of {totalPages}
            </div>
            
            <button
              onClick={() => handlePageChange(searchParams.page! + 1)}
              disabled={searchParams.page === totalPages}
              className={`px-4 py-2 border rounded-md ${
                searchParams.page === totalPages
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadSearch;
