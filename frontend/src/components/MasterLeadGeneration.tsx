// Master Real Estate Search Interface
// Frontend component for the comprehensive 26-API lead generation system

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  DollarSign, 
  Phone, 
  Mail, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Eye,
  Download,
  Filter,
  BarChart3,
  Zap
} from 'lucide-react';

interface MasterSearchParams {
  zipCodes: string[];
  minMotivationScore?: number;
  maxCostPerSearch?: number;
  requirePhoneNumber?: boolean;
  minEquity?: number;
  propertyTypes?: string[];
  searchType: 'ultimate' | 'probate' | 'foreclosure' | 'high-equity';
  limit?: number;
}

interface MasterPropertyRecord {
  propertyId: string;
  address: {
    fullAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
  owner: {
    names: string[];
  };
  valuation: {
    estimatedValue: number;
  };
  equity: {
    estimatedEquity: number;
  };
  aiAnalysis: {
    overallScore: number;
    motivationScore: number;
    contactabilityScore: number;
    dealPotentialScore: number;
    urgencyScore: number;
    predictedDiscount: number;
    dealProbability: number;
  };
  contacts: Array<{
    phones: string[];
    emails: string[];
  }>;
  distressSignals: any;
  dataSources: string[];
  lastUpdated: string;
}

interface SearchResponse {
  totalResults: number;
  properties: MasterPropertyRecord[];
  searchMetadata: {
    searchId: string;
    executionTime: number;
    totalApiCalls: number;
    totalCost: number;
    dataSourcesUsed: string[];
  };
  costBreakdown: any;
}

export const MasterLeadGeneration: React.FC = () => {
  const [searchParams, setSearchParams] = useState<MasterSearchParams>({
    zipCodes: [],
    searchType: 'ultimate',
    limit: 50
  });
  
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [currentZip, setCurrentZip] = useState('');

  // Load system status on mount
  useEffect(() => {
    loadSystemStatus();
    loadCostEstimate();
  }, []);

  const loadSystemStatus = async () => {
    try {
      const response = await fetch('/api/system/status');
      const status = await response.json();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const loadCostEstimate = async () => {
    try {
      const response = await fetch('/api/system/cost-estimate');
      const estimate = await response.json();
      setCostEstimate(estimate);
    } catch (error) {
      console.error('Failed to load cost estimate:', error);
    }
  };

  const addZipCode = () => {
    if (currentZip && !searchParams.zipCodes.includes(currentZip)) {
      setSearchParams(prev => ({
        ...prev,
        zipCodes: [...prev.zipCodes, currentZip]
      }));
      setCurrentZip('');
    }
  };

  const removeZipCode = (zip: string) => {
    setSearchParams(prev => ({
      ...prev,
      zipCodes: prev.zipCodes.filter(z => z !== zip)
    }));
  };

  const performSearch = async () => {
    if (searchParams.zipCodes.length === 0) {
      alert('Please add at least one zip code');
      return;
    }

    setLoading(true);
    try {
      const endpoint = `/api/master/${searchParams.searchType}-search`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
      alert(`Search failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    if (!results) return;
    
    const csv = convertToCSV(results.properties);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadflow-results-${Date.now()}.csv`;
    a.click();
  };

  const convertToCSV = (properties: MasterPropertyRecord[]): string => {
    const headers = [
      'Address', 'Owner', 'Value', 'Equity', 'Overall Score', 
      'Motivation Score', 'Deal Potential', 'Phone', 'Email', 
      'Data Sources', 'Last Updated'
    ];
    
    const rows = properties.map(prop => [
      prop.address.fullAddress,
      prop.owner.names.join(', '),
      prop.valuation.estimatedValue,
      prop.equity.estimatedEquity,
      prop.aiAnalysis.overallScore,
      prop.aiAnalysis.motivationScore,
      prop.aiAnalysis.dealPotentialScore,
      prop.contacts[0]?.phones[0] || '',
      prop.contacts[0]?.emails[0] || '',
      prop.dataSources.join(', '),
      new Date(prop.lastUpdated).toLocaleDateString()
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🏆 LeadFlow AI Master Platform
              </h1>
              <p className="text-gray-600 mt-2">
                Superior to PropStream, BatchLeads & REsimpli • 26 Premium APIs • AI-Powered Analysis
              </p>
            </div>
            
            {systemStatus && (
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  Tier: {systemStatus.tier} • APIs: {systemStatus.enabledAPIs}/{systemStatus.totalAPIs}
                </div>
                {costEstimate && (
                  <div className="text-sm text-gray-500">
                    Cost/Search: {formatCurrency(costEstimate.cost_per_search)} • 
                    Daily Limit: {formatCurrency(costEstimate.daily_budget_limit)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search Interface */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Search className="mr-2" />
            Master Property Search
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            
            {/* Search Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Type
              </label>
              <select
                value={searchParams.searchType}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  searchType: e.target.value as any
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ultimate">Ultimate Search (All Sources)</option>
                <option value="probate">Probate Leads</option>
                <option value="foreclosure">Foreclosure Leads</option>
                <option value="high-equity">High Equity Properties</option>
              </select>
            </div>

            {/* Zip Codes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Zip Codes
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={currentZip}
                  onChange={(e) => setCurrentZip(e.target.value)}
                  placeholder="Enter zip code"
                  className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && addZipCode()}
                />
                <button
                  onClick={addZipCode}
                  className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {searchParams.zipCodes.map(zip => (
                  <span
                    key={zip}
                    className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm flex items-center"
                  >
                    {zip}
                    <button
                      onClick={() => removeZipCode(zip)}
                      className="ml-1 text-gray-500 hover:text-gray-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Motivation Score
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={searchParams.minMotivationScore || ''}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  minMotivationScore: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                placeholder="0-100"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Equity
              </label>
              <input
                type="number"
                value={searchParams.minEquity || ''}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  minEquity: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                placeholder="e.g. 50000"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Additional Options */}
          <div className="flex items-center space-x-6 mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={searchParams.requirePhoneNumber || false}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  requirePhoneNumber: e.target.checked
                }))}
                className="mr-2"
              />
              Require Phone Number
            </label>
            
            <div className="flex items-center">
              <label className="text-sm font-medium text-gray-700 mr-2">
                Max Results:
              </label>
              <input
                type="number"
                value={searchParams.limit || 50}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  limit: parseInt(e.target.value)
                }))}
                className="w-20 border border-gray-300 rounded-md px-2 py-1"
                min="1"
                max="1000"
              />
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={performSearch}
            disabled={loading || searchParams.zipCodes.length === 0}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Searching 26 APIs...
              </>
            ) : (
              <>
                <Zap className="mr-2" />
                Generate Master Leads
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            
            {/* Results Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{results.totalResults}</div>
                  <div className="text-sm text-gray-600">Properties Found</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(results.searchMetadata.totalCost)}
                  </div>
                  <div className="text-sm text-gray-600">Total Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {results.searchMetadata.totalApiCalls}
                  </div>
                  <div className="text-sm text-gray-600">API Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {Math.round(results.searchMetadata.executionTime / 1000)}s
                  </div>
                  <div className="text-sm text-gray-600">Search Time</div>
                </div>
                <div className="text-center">
                  <button
                    onClick={exportResults}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center mx-auto"
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-gray-600">
                <strong>Data Sources Used:</strong> {results.searchMetadata.dataSourcesUsed.join(', ')}
              </div>
            </div>

            {/* Properties List */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Lead Results</h3>
              </div>
              
              <div className="divide-y">
                {results.properties.map((property, index) => (
                  <div key={property.propertyId} className="p-6 hover:bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      
                      {/* Property Info */}
                      <div className="lg:col-span-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-lg text-gray-900">
                              {property.address.fullAddress}
                            </h4>
                            <p className="text-gray-600 flex items-center mt-1">
                              <MapPin className="h-4 w-4 mr-1" />
                              {property.address.city}, {property.address.state}
                            </p>
                            <p className="text-gray-600 mt-1">
                              <strong>Owner:</strong> {property.owner.names.join(', ')}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreBadge(property.aiAnalysis.overallScore)}`}>
                            {property.aiAnalysis.overallScore}/100
                          </span>
                        </div>
                        
                        <div className="mt-3 flex flex-wrap gap-2">
                          {property.contacts[0]?.phones[0] && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {property.contacts[0].phones[0]}
                            </span>
                          )}
                          {property.contacts[0]?.emails[0] && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {property.contacts[0].emails[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Financial Info */}
                      <div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Est. Value:</span>
                            <span className="font-semibold">
                              {formatCurrency(property.valuation.estimatedValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Equity:</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(property.equity.estimatedEquity)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Discount:</span>
                            <span className="font-semibold text-blue-600">
                              {property.aiAnalysis.predictedDiscount}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Deal Prob:</span>
                            <span className="font-semibold">
                              {property.aiAnalysis.dealProbability}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI Scores */}
                      <div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Motivation:</span>
                            <div className={`font-semibold ${getScoreColor(property.aiAnalysis.motivationScore)}`}>
                              {property.aiAnalysis.motivationScore}/100
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Contact:</span>
                            <div className={`font-semibold ${getScoreColor(property.aiAnalysis.contactabilityScore)}`}>
                              {property.aiAnalysis.contactabilityScore}/100
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Deal:</span>
                            <div className={`font-semibold ${getScoreColor(property.aiAnalysis.dealPotentialScore)}`}>
                              {property.aiAnalysis.dealPotentialScore}/100
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Urgency:</span>
                            <div className={`font-semibold ${getScoreColor(property.aiAnalysis.urgencyScore)}`}>
                              {property.aiAnalysis.urgencyScore}/100
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-xs text-gray-500">
                          Sources: {property.dataSources.length} • 
                          Updated: {new Date(property.lastUpdated).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterLeadGeneration;
