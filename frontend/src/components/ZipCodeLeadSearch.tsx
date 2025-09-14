import { useState, useEffect } from 'react';
import { Search, MapPin, Phone, Download, RefreshCw, DollarSign, TrendingUp, Users, Filter, AlertCircle, CheckCircle, Eye, Mail } from 'lucide-react';
import RealEstateAPIService, { PropertySearchFilters, PropertyLead, PropertySearchResponse } from '../services/realEstateAPI';

interface ZipCodeLead {
  id: string;
  propertyAddress: string;
  ownerName: string;
  ownerPhone: string | null;
  ownerEmail: string | null;
  marketValue: number;
  aiScore: number;
  source: string;
  motivationScore: number;
  status: string;
  leadNotes: any[];
  tags: string[];
  createdAt: string;
  realEstateData?: {
    equity: number;
    equityPercent: number;
    propertyType: string;
    yearBuilt: number;
    squareFootage: number;
    bedrooms: number;
    bathrooms: number;
    dealPotential: string;
    distressSignals: any;
    taxDelinquency: any;
  };
}

interface ZipCodeStats {
  zipCode: string;
  city: string;
  county: string;
  leadCount: number;
  avgValue: number;
  avgScore: number;
  callableLeads: number;
  totalValue: number;
}

export default function ZipCodeLeadSearch() {
  const [searchZip, setSearchZip] = useState('');
  const [selectedZips, setSelectedZips] = useState<string[]>([]);
  const [leads, setLeads] = useState<ZipCodeLead[]>([]);
  const [zipStats, setZipStats] = useState<ZipCodeStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'single' | 'multiple' | 'area'>('single');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('lead_score');
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ZipCodeLead | null>(null);
  const [results, setResults] = useState<PropertySearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<PropertySearchFilters>({
    minValue: 100000,
    maxValue: 2000000,
    minEquityPercent: 20,
    includeForeclosures: true,
    includeProbate: true,
    includeTaxDelinquent: true,
    includeVacant: true,
    includeAbsenteeOwners: true
  });

  // Phoenix Metro zip codes
  const phoenixZips = [
    '85001', '85003', '85004', '85006', '85007', '85008', '85009', '85012',
    '85013', '85014', '85015', '85016', '85017', '85018', '85019', '85020',
    '85021', '85022', '85023', '85024', '85027', '85028', '85029', '85032',
    '85033', '85034', '85035', '85037', '85040', '85041', '85042', '85043'
  ];

  const scottsdaleZips = [
    '85250', '85251', '85252', '85253', '85254', '85255', '85256', '85257',
    '85258', '85259', '85260', '85261', '85262', '85263', '85264', '85266'
  ];

  const tempeZips = ['85281', '85282', '85283', '85284', '85285', '85287'];
  const mesaZips = ['85201', '85202', '85203', '85204', '85205', '85206', '85207', '85208'];

  const allTargetZips = [...phoenixZips, ...scottsdaleZips, ...tempeZips, ...mesaZips];

  // Search single zip code with REAL APIs
  const searchSingleZip = async () => {
    if (!searchZip || searchZip.length !== 5) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Searching REAL properties for zip code: ${searchZip}`);
      
      const response = await RealEstateAPIService.searchRealZipCode(searchZip, searchFilters);
      
      setResults(response);
      setLeads(response.leads);
      
      // Update zip stats with real data
      const stats: ZipCodeStats = {
        zipCode: searchZip,
        city: 'Phoenix Metro',
        county: 'Maricopa',
        leadCount: response.leadCount,
        avgValue: response.aggregations.averageValue,
        avgScore: Math.round(response.leads.reduce((sum, lead) => sum + lead.aiScore, 0) / response.leads.length),
        callableLeads: response.leads.filter(lead => lead.ownerPhone || lead.ownerEmail).length,
        totalValue: response.leads.reduce((sum, lead) => sum + lead.marketValue, 0)
      };
      
      setZipStats([stats]);
      
      console.log(`✅ REAL search completed: ${response.leadCount} properties found`);
      console.log(`💰 Search cost: ${RealEstateAPIService.formatCurrency(response.metadata.totalCost)}`);
      
    } catch (error: any) {
      console.error('❌ Real property search failed:', error);
      setError(error.message || 'Failed to search properties');
      setLeads([]);
      setZipStats([]);
    } finally {
      setLoading(false);
    }
  };

  // Search multiple zip codes with REAL APIs
  const searchMultipleZips = async () => {
    if (selectedZips.length === 0) {
      setError('Please select at least one zip code');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log(`🌍 Searching REAL properties for ${selectedZips.length} zip codes`);
      
      const response = await RealEstateAPIService.searchRealMultipleZips(selectedZips, searchFilters);
      
      setResults(response);
      setLeads(response.leads);
      
      // Create stats for each zip
      const statsMap = new Map<string, number>();
      response.leads.forEach(lead => {
        const zipMatch = lead.propertyAddress.match(/\b\d{5}\b/);
        if (zipMatch) {
          const zip = zipMatch[0];
          statsMap.set(zip, (statsMap.get(zip) || 0) + 1);
        }
      });
      
      const newStats: ZipCodeStats[] = selectedZips.map(zip => ({
        zipCode: zip,
        city: 'Phoenix Metro',
        county: 'Maricopa',
        leadCount: statsMap.get(zip) || 0,
        avgValue: response.aggregations.averageValue,
        avgScore: Math.round(response.aggregations.averageValue / 10000),
        callableLeads: response.leads.filter(lead => lead.ownerPhone || lead.ownerEmail).length,
        totalValue: response.leads.reduce((sum, lead) => sum + lead.marketValue, 0)
      }));
      
      setZipStats(newStats);
      
      console.log(`✅ REAL multi-zip search completed: ${response.leadCount} properties found`);
      console.log(`💰 Search cost: ${RealEstateAPIService.formatCurrency(response.metadata.totalCost)}`);
      
    } catch (error: any) {
      console.error('❌ Real multi-zip search failed:', error);
      setError(error.message || 'Failed to search multiple zip codes');
      setLeads([]);
      setZipStats([]);
    } finally {
      setLoading(false);
    }
  };

  // Search entire target area with REAL APIs
  const searchTargetArea = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🎯 Searching REAL target area (Phoenix Metro) with premium APIs');
      
      const response = await RealEstateAPIService.searchRealTargetArea({
        ...searchFilters,
        requireDistressSignals: true, // Focus on motivated sellers
        limit: 200 // Get more results for area search
      });
      
      setResults(response);
      setLeads(response.leads);
      
      // Create comprehensive stats for entire area
      const areaStats: ZipCodeStats = {
        zipCode: 'Phoenix Metro',
        city: 'Multiple Cities',
        county: 'Maricopa',
        leadCount: response.leadCount,
        avgValue: response.aggregations.averageValue,
        avgScore: Math.round(response.leads.reduce((sum, lead) => sum + lead.aiScore, 0) / response.leads.length),
        callableLeads: response.leads.filter(lead => lead.ownerPhone || lead.ownerEmail).length,
        totalValue: response.leads.reduce((sum, lead) => sum + lead.marketValue, 0)
      };
      
      setZipStats([areaStats]);
      
      console.log(`✅ REAL target area search completed: ${response.leadCount} properties found`);
      console.log(`💰 Search cost: ${RealEstateAPIService.formatCurrency(response.metadata.totalCost)}`);
      
    } catch (error: any) {
      console.error('❌ Real target area search failed:', error);
      setError(error.message || 'Failed to search target area');
      setLeads([]);
      setZipStats([]);
    } finally {
      setLoading(false);
    }
  };

  // Load zip code statistics
  const loadZipStats = async () => {
    try {
      // Create mock zip code stats
      const mockStats: ZipCodeStats[] = [
        {
          zipCode: '85001',
          city: 'Phoenix',
          county: 'Maricopa',
          leadCount: 12,
          avgValue: 325000,
          avgScore: 78.5,
          callableLeads: 8,
          totalValue: 3900000
        },
        {
          zipCode: '85251',
          city: 'Scottsdale',
          county: 'Maricopa',
          leadCount: 8,
          avgValue: 485000,
          avgScore: 84.2,
          callableLeads: 6,
          totalValue: 3880000
        },
        {
          zipCode: '85032',
          city: 'Phoenix',
          county: 'Maricopa',
          leadCount: 15,
          avgValue: 295000,
          avgScore: 72.1,
          callableLeads: 11,
          totalValue: 4425000
        }
      ];
      
      setZipStats(mockStats);
    } catch (error) {
      console.error('Error loading zip stats:', error);
    }
  };

  // Load existing leads
  const loadExistingLeads = async () => {
    setLoading(true);
    try {
      // For now, create mock data since backend isn't fully connected
      const mockLeads: ZipCodeLead[] = [
        {
          id: '1',
          propertyAddress: '1234 Main St, Phoenix, AZ 85001',
          ownerName: 'John Smith',
          ownerPhone: '602-555-0123',
          ownerEmail: 'john.smith@email.com',
          marketValue: 350000,
          aiScore: 85,
          source: 'zillow_fsbo',
          motivationScore: 75,
          status: 'new',
          leadNotes: [],
          tags: ['high_equity'],
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          propertyAddress: '5678 Oak Ave, Scottsdale, AZ 85251',
          ownerName: 'Jane Doe',
          ownerPhone: null,
          ownerEmail: 'jane.doe@email.com',
          marketValue: 450000,
          aiScore: 92,
          source: 'realtor_com',
          motivationScore: 88,
          status: 'contacted',
          leadNotes: [],
          tags: ['probate'],
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          propertyAddress: '9101 Desert View Dr, Phoenix, AZ 85032',
          ownerName: 'Bob Johnson',
          ownerPhone: '480-555-0456',
          ownerEmail: null,
          marketValue: 275000,
          aiScore: 78,
          source: 'nj_property_records',
          motivationScore: 65,
          status: 'hot',
          leadNotes: [],
          tags: ['tax_delinquent'],
          createdAt: new Date().toISOString()
        }
      ];
      
      setLeads(mockLeads);
      await loadZipStats();
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExistingLeads();
  }, []);

  // Filter and sort leads
  const filteredLeads = leads
    .filter(lead => {
      if (filterSource !== 'all' && lead.source !== filterSource) return false;
      if (filterStatus !== 'all' && lead.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'lead_score': return (b.aiScore || 0) - (a.aiScore || 0);
        case 'estimated_value': return (b.marketValue || 0) - (a.marketValue || 0);
        case 'motivation_score': return (b.motivationScore || 0) - (a.motivationScore || 0);
        case 'created_at': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });

  const handleZipToggle = (zip: string) => {
    setSelectedZips(prev => 
      prev.includes(zip) 
        ? prev.filter(z => z !== zip)
        : [...prev, zip]
    );
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      'zillow_fsbo': 'bg-purple-100 text-purple-800',
      'realtor_com': 'bg-blue-100 text-blue-800',
      'craigslist': 'bg-orange-100 text-orange-800',
      'nj_property_records': 'bg-red-100 text-red-800',
      'manual': 'bg-yellow-100 text-yellow-800'
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 font-bold';
    if (score >= 60) return 'text-yellow-600 font-semibold';
    return 'text-red-600';
  };

  const extractZipFromAddress = (address: string) => {
    const match = address.match(/\b(\d{5})\b/);
    return match ? match[1] : 'Unknown';
  };

  const showContactScript = (lead: ZipCodeLead) => {
    setSelectedLead(lead);
    setShowContactModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <MapPin className="text-blue-600" />
              Zip Code Lead Search
            </h1>
            <p className="text-gray-600 mt-2">Search specific zip codes for real estate leads in your target market</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{filteredLeads.length}</div>
            <div className="text-sm text-gray-500">Total Leads</div>
          </div>
        </div>
      </div>

      {/* Search Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="space-y-4">
          {/* Search Mode Selection */}
          <div className="flex gap-4">
            <button
              onClick={() => setSearchMode('single')}
              className={`px-4 py-2 rounded-lg border ${
                searchMode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              Single Zip
            </button>
            <button
              onClick={() => setSearchMode('multiple')}
              className={`px-4 py-2 rounded-lg border ${
                searchMode === 'multiple' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              Multiple Zips
            </button>
            <button
              onClick={() => setSearchMode('area')}
              className={`px-4 py-2 rounded-lg border ${
                searchMode === 'area' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              Entire Area
            </button>
          </div>

          {/* Single Zip Search */}
          {searchMode === 'single' && (
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Zip Code
                </label>
                <input
                  type="text"
                  value={searchZip}
                  onChange={(e) => setSearchZip(e.target.value)}
                  placeholder="85251"
                  maxLength={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={searchSingleZip}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
          )}

          {/* Multiple Zip Search */}
          {searchMode === 'multiple' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Zip Codes ({selectedZips.length} selected)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 max-h-60 overflow-y-auto border rounded-lg p-4">
                {allTargetZips.map(zip => (
                  <label key={zip} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedZips.includes(zip)}
                      onChange={() => handleZipToggle(zip)}
                      className="rounded"
                    />
                    <span className="text-sm">{zip}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={searchMultipleZips}
                disabled={loading || selectedZips.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search Selected Zips
              </button>
            </div>
          )}

          {/* Entire Area Search */}
          {searchMode === 'area' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Search all Phoenix, Scottsdale, Tempe, and Mesa zip codes ({allTargetZips.length} total)
              </p>
              <button
                onClick={searchTargetArea}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search Entire Target Area
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setSelectedZips(['85251', '85254', '85260']);
              setSearchMode('multiple');
            }}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
          >
            Select Scottsdale Zips
          </button>
          <button
            onClick={() => {
              setSelectedZips(['85001', '85018', '85032']);
              setSearchMode('multiple');
            }}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
          >
            Select Phoenix Zips
          </button>
          <button
            onClick={() => {
              setSelectedZips(['85281', '85283', '85201', '85203']);
              setSearchMode('multiple');
            }}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            Select Tempe/Mesa Zips
          </button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sources</option>
                <option value="zillow_fsbo">Zillow FSBO</option>
                <option value="realtor_com">Realtor.com</option>
                <option value="craigslist">Craigslist</option>
                <option value="nj_property_records">Property Records</option>
                <option value="manual">Manual Entry</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="hot">Hot</option>
                <option value="qualified">Qualified</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="lead_score">Lead Score</option>
                <option value="estimated_value">Property Value</option>
                <option value="motivation_score">Motivation</option>
                <option value="created_at">Date Added</option>
              </select>
            </div>
          </div>
          <button
            onClick={loadExistingLeads}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Zip Code Stats */}
      {zipStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Zip Code Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zipStats.slice(0, 6).map(stat => (
              <div key={stat.zipCode} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-lg">{stat.zipCode}</div>
                    <div className="text-sm text-gray-600">{stat.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{stat.leadCount} leads</div>
                    <div className="text-sm text-green-600">{stat.callableLeads} callable</div>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <div>Avg Value: ${stat.avgValue.toLocaleString()}</div>
                  <div>Avg Score: {stat.avgScore.toFixed(1)}/100</div>
                  <div>Total Value: ${stat.totalValue.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Leads Found ({filteredLeads.length})
            </h3>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{lead.propertyAddress}</div>
                      <div className="text-sm text-gray-500">ZIP: {extractZipFromAddress(lead.propertyAddress)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{lead.ownerName}</div>
                    <div className="text-sm text-gray-500">{lead.status}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.ownerPhone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-900">{lead.ownerPhone}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Skip trace needed</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${(lead.marketValue || 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getScoreColor(lead.aiScore || 0)}`}>
                      {lead.aiScore || 0}/100
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSourceColor(lead.source)}`}>
                      {lead.source.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {lead.ownerPhone && (
                        <button
                          onClick={() => showContactScript(lead)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Script
                        </button>
                      )}
                      <button className="text-green-600 hover:text-green-900">
                        Contact
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contact Script Modal */}
      {showContactModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Contact Script</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Property: {selectedLead.propertyAddress}</h4>
                <p>Owner: {selectedLead.ownerName}</p>
                <p>Phone: {selectedLead.ownerPhone}</p>
                <p>Score: {selectedLead.aiScore}/100</p>
              </div>
              <div>
                <h4 className="font-semibold">Opening Script:</h4>
                <p className="text-sm bg-gray-100 p-3 rounded">
                  "Hi {selectedLead.ownerName?.split(' ')[0]}, I'm a local real estate investor. 
                  I help property owners in situations where they need to sell quickly. 
                  I believe you own the property at {selectedLead.propertyAddress}?"
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Value Proposition:</h4>
                <p className="text-sm bg-gray-100 p-3 rounded">
                  "I can close in 10-14 days, all cash, no inspections, no repairs needed, 
                  and handle all the paperwork."
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Offer Range:</h4>
                <p className="text-sm bg-green-100 p-3 rounded">
                  ${Math.round((selectedLead.marketValue || 0) * 0.75).toLocaleString()} - 
                  ${Math.round((selectedLead.marketValue || 0) * 0.85).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
