// Advanced Probate Lead Generation Interface
// Specialized React component for comprehensive probate property lead mining

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Clock, 
  Users, 
  DollarSign, 
  Phone, 
  Mail, 
  AlertTriangle,
  TrendingUp,
  FileText,
  MapPin,
  Calendar,
  Download,
  Filter,
  BarChart3,
  Zap,
  Heart,
  Scale,
  Home,
  UserCheck
} from 'lucide-react';

interface ProbateSearchParams {
  zipCode: string;
  radius?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  minAge?: number;
  minEquity?: number;
  minValue?: number;
  maxValue?: number;
  propertyTypes?: string[];
  minMotivationScore?: number;
  requireContact?: boolean;
  probateStatusFilter?: string[];
  limit?: number;
}

interface ProbateProperty {
  propertyId: string;
  address: {
    fullAddress: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
  };
  deceasedOwner: {
    fullName: string;
    dateOfDeath: string;
    age: number;
    daysSinceDeath?: number;
    familyMembers: Array<{
      name: string;
      relationship: string;
      age?: number;
    }>;
  };
  probateStatus: string;
  estimatedValue: number;
  estimatedEquity: number;
  propertyType: string;
  squareFootage?: number;
  yearBuilt?: number;
  bedrooms?: number;
  bathrooms?: number;
  motivationFactors: {
    timeUrgency: number;
    financialPressure: number;
    propertyCondition: number;
    heirSituation: number;
    marketFactors: number;
    overallScore: number;
  };
  aiAnalysis: {
    motivationScore: number;
    urgencyScore: number;
    dealPotentialScore: number;
    contactabilityScore: number;
    discountPotential: number;
    reasoning: string;
    recommendation: string;
    keyFactors: string[];
    riskAssessment: string;
    estimatedTimeToClose: number;
    suggestedApproach: string;
  };
  estateContacts?: Array<{
    name: string;
    relationship: string;
    contactInfo: {
      phones: Array<{ number: string; type: string }>;
      emails: Array<{ email: string; type: string }>;
    };
    reliability: string;
  }>;
  urgencyIndicators?: Array<{
    type: string;
    severity: string;
    description: string;
    estimatedImpact: number;
  }>;
  lastUpdated: string;
}

interface ProbateSearchResponse {
  totalResults: number;
  properties: ProbateProperty[];
  searchMetadata: {
    searchId: string;
    executionTime: number;
    totalCost: number;
    costBreakdown: Record<string, number>;
    dataSourcesUsed: string[];
  };
}

export const AdvancedProbateLeads: React.FC = () => {
  const [searchParams, setSearchParams] = useState<ProbateSearchParams>({
    zipCode: '',
    radius: 10,
    minAge: 50,
    minMotivationScore: 70,
    requireContact: false,
    limit: 25
  });
  
  const [results, setResults] = useState<ProbateSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<ProbateProperty | null>(null);
  const [searchType, setSearchType] = useState<'comprehensive' | 'quick'>('comprehensive');
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<any>(null);

  useEffect(() => {
    loadSystemStatus();
  }, []);

  const loadSystemStatus = async () => {
    try {
      const response = await fetch('/api/probate/system-status');
      const status = await response.json();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const loadMarketAnalysis = async (zipCode: string) => {
    try {
      const response = await fetch(`/api/probate/market-analysis/${zipCode}`);
      const analysis = await response.json();
      setMarketAnalysis(analysis.data);
    } catch (error) {
      console.error('Failed to load market analysis:', error);
    }
  };

  const performProbateSearch = async () => {
    if (!searchParams.zipCode) {
      alert('Please enter a zip code');
      return;
    }

    setLoading(true);
    try {
      const endpoint = searchType === 'comprehensive' 
        ? '/api/probate/comprehensive-search'
        : '/api/probate/quick-search';
        
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
      setResults(data.data);
      
      // Load market analysis for this zip code
      await loadMarketAnalysis(searchParams.zipCode);
      
    } catch (error) {
      console.error('Probate search failed:', error);
      alert(`Search failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const analyzeSingleProperty = async (address: string, deceasedName: string, dateOfDeath?: string) => {
    try {
      const response = await fetch('/api/probate/analyze-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, deceasedName, dateOfDeath }),
      });

      const analysis = await response.json();
      // Handle individual property analysis
      console.log('Property analysis:', analysis.data);
    } catch (error) {
      console.error('Property analysis failed:', error);
    }
  };

  const exportResults = () => {
    if (!results) return;
    
    const csv = convertProbateToCSV(results.properties);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `probate-leads-${searchParams.zipCode}-${Date.now()}.csv`;
    a.click();
  };

  const convertProbateToCSV = (properties: ProbateProperty[]): string => {
    const headers = [
      'Address', 'Deceased Owner', 'Date of Death', 'Days Since Death', 'Property Value', 
      'Equity', 'Motivation Score', 'Urgency Score', 'Deal Potential', 'Contact Score',
      'Discount Potential', 'Probate Status', 'Primary Contact', 'Phone', 'Email',
      'Risk Level', 'Time to Close', 'Recommendation', 'Last Updated'
    ];
    
    const rows = properties.map(prop => {
      const daysSinceDeath = Math.floor(
        (Date.now() - new Date(prop.deceasedOwner.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const primaryContact = prop.estateContacts?.[0];
      
      return [
        prop.address.fullAddress,
        prop.deceasedOwner.fullName,
        new Date(prop.deceasedOwner.dateOfDeath).toLocaleDateString(),
        daysSinceDeath,
        prop.estimatedValue,
        prop.estimatedEquity,
        prop.aiAnalysis.motivationScore,
        prop.aiAnalysis.urgencyScore,
        prop.aiAnalysis.dealPotentialScore,
        prop.aiAnalysis.contactabilityScore,
        `${prop.aiAnalysis.discountPotential}%`,
        prop.probateStatus.replace(/_/g, ' '),
        primaryContact?.name || '',
        primaryContact?.contactInfo.phones[0]?.number || '',
        primaryContact?.contactInfo.emails[0]?.email || '',
        prop.aiAnalysis.riskAssessment,
        `${prop.aiAnalysis.estimatedTimeToClose} days`,
        prop.aiAnalysis.recommendation,
        new Date(prop.lastUpdated).toLocaleDateString()
      ];
    });
    
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

  const getProbateStatusBadge = (status: string) => {
    switch (status) {
      case 'probate_initiated': return 'bg-blue-100 text-blue-800';
      case 'in_probate': return 'bg-orange-100 text-orange-800';
      case 'probate_closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-purple-100 text-purple-800';
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Heart className="mr-3 text-red-500" />
                Advanced Probate Lead Mining
              </h1>
              <p className="text-gray-600 mt-2">
                Comprehensive deceased owner property identification • 7 Data Sources • AI Analysis
              </p>
            </div>
            
            {systemStatus && (
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  Status: {systemStatus.systemHealth} • Success Rate: {systemStatus.performance.successRate}
                </div>
                <div className="text-sm text-gray-500">
                  Avg Cost: ${systemStatus.averageCosts.comprehensiveSearch} • Response: {systemStatus.performance.averageResponseTime}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Interface */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Search className="mr-2" />
            Probate Property Search
          </h2>
          
          {/* Search Type Selection */}
          <div className="mb-6">
            <div className="flex space-x-4">
              <button
                onClick={() => setSearchType('comprehensive')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  searchType === 'comprehensive'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Zap className="inline mr-2 h-4 w-4" />
                Comprehensive Search ($1.80)
              </button>
              <button
                onClick={() => setSearchType('quick')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  searchType === 'quick'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Clock className="inline mr-2 h-4 w-4" />
                Quick Search ($0.85)
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            
            {/* Zip Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Zip Code *
              </label>
              <input
                type="text"
                value={searchParams.zipCode}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  zipCode: e.target.value
                }))}
                placeholder="e.g. 90210"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Search Radius */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Radius (miles)
              </label>
              <select
                value={searchParams.radius}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  radius: parseInt(e.target.value)
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={15}>15 miles</option>
                <option value={25}>25 miles</option>
              </select>
            </div>

            {/* Minimum Age */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Age at Death
              </label>
              <input
                type="number"
                value={searchParams.minAge}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  minAge: parseInt(e.target.value)
                }))}
                min="40"
                max="100"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Min Motivation Score */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Motivation Score
              </label>
              <input
                type="number"
                value={searchParams.minMotivationScore}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  minMotivationScore: parseInt(e.target.value)
                }))}
                min="0"
                max="100"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Min Equity */}
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
                placeholder="e.g. 100000"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Property Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Types
              </label>
              <select
                multiple
                value={searchParams.propertyTypes || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setSearchParams(prev => ({
                    ...prev,
                    propertyTypes: selected
                  }));
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={3}
              >
                <option value="single-family">Single Family</option>
                <option value="condo">Condo</option>
                <option value="townhouse">Townhouse</option>
                <option value="multi-family">Multi-Family</option>
              </select>
            </div>

            {/* Max Results */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Results
              </label>
              <select
                value={searchParams.limit}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  limit: parseInt(e.target.value)
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10 results</option>
                <option value={25}>25 results</option>
                <option value={50}>50 results</option>
                <option value={100}>100 results</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Death Date Range
              </label>
              <select
                onChange={(e) => {
                  const months = parseInt(e.target.value);
                  const end = new Date().toISOString();
                  const start = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
                  setSearchParams(prev => ({
                    ...prev,
                    dateRange: { start, end }
                  }));
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
                <option value={18}>Last 18 months</option>
                <option value={24}>Last 24 months</option>
              </select>
            </div>
          </div>

          {/* Additional Options */}
          <div className="flex items-center space-x-6 mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={searchParams.requireContact || false}
                onChange={(e) => setSearchParams(prev => ({
                  ...prev,
                  requireContact: e.target.checked
                }))}
                className="mr-2"
              />
              Require Estate Contact Info
            </label>
          </div>

          {/* Search Button */}
          <button
            onClick={performProbateSearch}
            disabled={loading || !searchParams.zipCode}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Mining Probate Leads...
              </>
            ) : (
              <>
                <Heart className="mr-2" />
                Find Probate Opportunities
              </>
            )}
          </button>
        </div>

        {/* Market Analysis */}
        {marketAnalysis && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart3 className="mr-2" />
              Probate Market Analysis - {searchParams.zipCode}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{marketAnalysis.probateMarketData.totalProbateProperties}</div>
                <div className="text-sm text-gray-600">Probate Properties</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{marketAnalysis.probateMarketData.averageDiscountFromMarket}%</div>
                <div className="text-sm text-gray-600">Avg Discount</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{marketAnalysis.probateMarketData.averageDaysOnMarket}</div>
                <div className="text-sm text-gray-600">Days on Market</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{marketAnalysis.opportunities.averageROI}</div>
                <div className="text-sm text-gray-600">Average ROI</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            
            {/* Results Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Probate Lead Results</h3>
                <button
                  onClick={exportResults}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
                >
                  <Download className="mr-1 h-4 w-4" />
                  Export CSV
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{results.totalResults}</div>
                  <div className="text-sm text-gray-600">Probate Leads</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    ${results.searchMetadata.totalCost.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Search Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {results.searchMetadata.dataSourcesUsed.length}
                  </div>
                  <div className="text-sm text-gray-600">Data Sources</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {Math.round(results.searchMetadata.executionTime / 1000)}s
                  </div>
                  <div className="text-sm text-gray-600">Search Time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {results.properties.filter(p => p.aiAnalysis.motivationScore >= 85).length}
                  </div>
                  <div className="text-sm text-gray-600">High Priority</div>
                </div>
              </div>
            </div>

            {/* Properties List */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="divide-y">
                {results.properties.map((property) => {
                  const daysSinceDeath = Math.floor(
                    (Date.now() - new Date(property.deceasedOwner.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  
                  return (
                    <div key={property.propertyId} className="p-6 hover:bg-gray-50">
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        
                        {/* Property Info */}
                        <div className="lg:col-span-2">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-lg text-gray-900">
                                {property.address.fullAddress}
                              </h4>
                              <p className="text-gray-600 flex items-center mt-1">
                                <MapPin className="h-4 w-4 mr-1" />
                                {property.address.city}, {property.address.state}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreBadge(property.aiAnalysis.motivationScore)}`}>
                              {property.aiAnalysis.motivationScore}/100
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center text-sm">
                              <Heart className="h-4 w-4 mr-2 text-red-500" />
                              <span className="font-medium">Deceased:</span>
                              <span className="ml-1">{property.deceasedOwner.fullName}</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                              <span>{daysSinceDeath} days ago</span>
                              <span className="ml-2 text-gray-500">
                                ({new Date(property.deceasedOwner.dateOfDeath).toLocaleDateString()})
                              </span>
                            </div>
                            <div className="flex items-center text-sm">
                              <Users className="h-4 w-4 mr-2 text-blue-500" />
                              <span>{property.deceasedOwner.familyMembers.length} family members</span>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getProbateStatusBadge(property.probateStatus)}`}>
                              {property.probateStatus.replace(/_/g, ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadge(property.aiAnalysis.riskAssessment)}`}>
                              {property.aiAnalysis.riskAssessment} risk
                            </span>
                            {property.estateContacts && property.estateContacts.length > 0 && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium flex items-center">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Contact Available
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
                                {formatCurrency(property.estimatedValue)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Equity:</span>
                              <span className="font-semibold text-green-600">
                                {formatCurrency(property.estimatedEquity)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Discount:</span>
                              <span className="font-semibold text-blue-600">
                                {property.aiAnalysis.discountPotential}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Type:</span>
                              <span className="font-semibold">
                                {property.propertyType}
                              </span>
                            </div>
                            {property.squareFootage && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Sq Ft:</span>
                                <span className="font-semibold">
                                  {property.squareFootage.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* AI Analysis Scores */}
                        <div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Motivation:</span>
                              <div className={`font-semibold ${getScoreColor(property.aiAnalysis.motivationScore)}`}>
                                {property.aiAnalysis.motivationScore}/100
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Urgency:</span>
                              <div className={`font-semibold ${getScoreColor(property.aiAnalysis.urgencyScore)}`}>
                                {property.aiAnalysis.urgencyScore}/100
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Deal:</span>
                              <div className={`font-semibold ${getScoreColor(property.aiAnalysis.dealPotentialScore)}`}>
                                {property.aiAnalysis.dealPotentialScore}/100
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">Contact:</span>
                              <div className={`font-semibold ${getScoreColor(property.aiAnalysis.contactabilityScore)}`}>
                                {property.aiAnalysis.contactabilityScore}/100
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 text-xs text-gray-500">
                            Time to Close: {property.aiAnalysis.estimatedTimeToClose} days
                          </div>
                        </div>

                        {/* Contact Info & Actions */}
                        <div>
                          {property.estateContacts && property.estateContacts.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {property.estateContacts.slice(0, 2).map((contact, idx) => (
                                <div key={idx} className="text-sm">
                                  <div className="font-medium">{contact.name}</div>
                                  <div className="text-gray-600 text-xs">{contact.relationship}</div>
                                  {contact.contactInfo.phones[0] && (
                                    <div className="flex items-center text-xs">
                                      <Phone className="h-3 w-3 mr-1" />
                                      {contact.contactInfo.phones[0].number}
                                    </div>
                                  )}
                                  {contact.contactInfo.emails[0] && (
                                    <div className="flex items-center text-xs">
                                      <Mail className="h-3 w-3 mr-1" />
                                      {contact.contactInfo.emails[0].email}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <button
                              onClick={() => setSelectedProperty(property)}
                              className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => analyzeSingleProperty(
                                property.address.fullAddress,
                                property.deceasedOwner.fullName,
                                property.deceasedOwner.dateOfDeath
                              )}
                              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
                            >
                              Deep Analysis
                            </button>
                          </div>
                          
                          <div className="mt-3 text-xs text-gray-500">
                            Recommendation: {property.aiAnalysis.recommendation}
                          </div>
                        </div>
                      </div>
                      
                      {/* Urgency Indicators */}
                      {property.urgencyIndicators && property.urgencyIndicators.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center mb-2">
                            <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                            <span className="text-sm font-medium">Urgency Indicators:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {property.urgencyIndicators.map((indicator, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-1 rounded text-xs ${
                                  indicator.severity === 'high' ? 'bg-red-100 text-red-800' :
                                  indicator.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {indicator.description}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Property Detail Modal */}
        {selectedProperty && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Probate Property Details</h3>
                  <button
                    onClick={() => setSelectedProperty(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Detailed property information would go here */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Property Information</h4>
                    <p><strong>Address:</strong> {selectedProperty.address.fullAddress}</p>
                    <p><strong>Value:</strong> {formatCurrency(selectedProperty.estimatedValue)}</p>
                    <p><strong>Equity:</strong> {formatCurrency(selectedProperty.estimatedEquity)}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Deceased Owner</h4>
                    <p><strong>Name:</strong> {selectedProperty.deceasedOwner.fullName}</p>
                    <p><strong>Date of Death:</strong> {new Date(selectedProperty.deceasedOwner.dateOfDeath).toLocaleDateString()}</p>
                    <p><strong>Age:</strong> {selectedProperty.deceasedOwner.age}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">AI Analysis</h4>
                    <p><strong>Reasoning:</strong> {selectedProperty.aiAnalysis.reasoning}</p>
                    <p><strong>Approach:</strong> {selectedProperty.aiAnalysis.suggestedApproach}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedProbateLeads;
