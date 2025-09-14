import { useState, FC } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Spinner } from '../ui/Spinner';

interface ScraperConfig {
  zipCodes?: string;
  maxPages?: number;
  county?: string;
  state?: string;
  auctionType?: string;
  dateRange?: string;
  useEnhanced?: boolean;
}

interface ScraperConfigPanelProps {
  scraperType: string;
  title: string;
  description: string;
  onJobStarted: () => void;
}

export const ScraperConfigPanel: FC<ScraperConfigPanelProps> = ({
  scraperType,
  title,
  description,
  onJobStarted
}) => {
  const [config, setConfig] = useState<ScraperConfig>({
    zipCodes: '07001, 07002, 07003',
    maxPages: 3,
    county: '',
    state: '',
    auctionType: '',
    dateRange: '30',
    useEnhanced: true
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Update a single config field
  const updateConfig = (field: keyof ScraperConfig, value: string | number) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Start a new scraping job with enhanced error handling
  const startScraping = async () => {
    // Validate config based on scraper type
    if (scraperType === 'zillow' && (!config.zipCodes || !config.zipCodes.trim())) {
      toast.error('Please enter at least one zip code');
      return;
    }

    if (scraperType === 'auction' && !config.state) {
      toast.error('Please select a state');
      return;
    }

    if (scraperType === 'county' && (!config.county || !config.state)) {
      toast.error('Please select both county and state');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Determine API endpoint based on scraper type
      const endpoint = `/api/scraper/${scraperType}`;
      
      // Prepare request payload based on scraper type
      let payload: any = {};
      
      if (scraperType === 'zillow') {
        // Extract zip codes, ensuring they're properly formatted
        const zipCodeArray = config.zipCodes?.split(',')
          .map(zip => zip.trim())
          .filter(Boolean) || [];
          
        console.log('Zip codes for API:', zipCodeArray);
        
        // Validate at least one zip code is provided
        if (zipCodeArray.length === 0) {
          toast.error('Please enter at least one valid zip code');
          setIsLoading(false);
          return;
        }
        
        // Validate zip code format
        const invalidZips = zipCodeArray.filter(zip => !/^\d{5}(-\d{4})?$/.test(zip));
        if (invalidZips.length > 0) {
          toast.error(`Invalid zip code format: ${invalidZips.join(', ')}`);
          setIsLoading(false);
          return;
        }
        
        payload = {
          zipCodes: zipCodeArray,
          maxPages: Number(config.maxPages) || 3,
          useEnhanced: Boolean(config.useEnhanced)
        };
      } else if (scraperType === 'auction') {
        payload = {
          state: config.state,
          auctionType: config.auctionType || 'all',
          maxPages: Number(config.maxPages) || 3,
          useEnhanced: Boolean(config.useEnhanced)
        };
      } else if (scraperType === 'county') {
        payload = {
          county: config.county,
          state: config.state,
          dateRange: parseInt(config.dateRange || '30')
        };
      }
      
      console.log(`\n\nSending ${scraperType} scraper request:`, payload);
      
      const response = await axios.post(endpoint, payload, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Source': 'scraper-ui'
        }
      });
      
      if (response.data.success) {
        const jobId = response.data.data?.jobId;
        toast.success(`${title} scraping job started successfully${jobId ? ` (ID: ${jobId.substring(0, 8)}...)` : ''}`);
        onJobStarted(); // Notify parent component to refresh job list
      } else {
        // Handle server error response with message
        const errorMessage = response.data.message || `Failed to start ${title.toLowerCase()} scraping job`;
        toast.error(errorMessage);
        console.error('Server returned error:', response.data);
      }
    } catch (error: any) {
      console.error(`Error starting ${scraperType} scraping job:`, error);
      
      // Extract more useful error information
      let errorMessage = `Failed to start ${title.toLowerCase()} scraping job`;
      let detailMessage = '';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const status = error.response.status;
        const serverError = error.response.data?.message || 'Unknown server error';
        
        errorMessage = `Server error (${status}): ${serverError}`;
        detailMessage = `Response data: ${JSON.stringify(error.response.data || {})}`;
        
        console.error(`Server error ${status}:`, error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your network connection.';
        detailMessage = 'The request was sent but received no response. The server might be down or unreachable.';
        
        console.error('No response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an error
        errorMessage = error.message || 'Unknown error occurred';
        detailMessage = 'There was a problem with the request setup.';
      }
      
      // Show error toast with more details
      toast.error(errorMessage);
      
      // Log additional details
      console.error(`Detailed error: ${detailMessage}`);
      
      // If it's a network timeout, provide a specific message
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error('Request timed out. The server might be busy or experiencing issues.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render fields based on scraper type
  const renderConfigFields = () => {
    switch (scraperType) {
      case 'zillow':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Zip Codes (comma separated)
              </label>
              <input
                type="text"
                className="input-field mt-1"
                placeholder="07001, 07002, 07003"
                value={config.zipCodes}
                onChange={(e) => updateConfig('zipCodes', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Enter zip codes where you want to search for properties</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Pages
              </label>
              <input
                type="number"
                className="input-field mt-1"
                value={config.maxPages}
                onChange={(e) => updateConfig('maxPages', parseInt(e.target.value))}
                min={1}
                max={10}
              />
              <p className="text-xs text-gray-500 mt-1">More pages = more results but takes longer</p>
            </div>

            <div className="flex items-center mt-4">
              <label className="block text-sm font-medium text-gray-700 mr-3" title="Enhanced version uses advanced anti-detection measures but may run slower. Standard version is faster but more easily detected.">
                Use Enhanced Version
                <span className="ml-1 text-xs text-blue-500 cursor-help">ℹ️</span>
              </label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  id="zillow-toggle"
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                  checked={config.useEnhanced}
                  onChange={(e) => updateConfig('useEnhanced', e.target.checked as any)}
                />
                <label
                  htmlFor="zillow-toggle"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
              <span className="text-xs text-gray-600">
                {config.useEnhanced ? '🚀 Enhanced' : '📄 Standard'}
              </span>
            </div>
          </>
        );

      case 'auction':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                State
              </label>
              <select
                className="input-field mt-1"
                value={config.state}
                onChange={(e) => updateConfig('state', e.target.value)}
              >
                <option value="">Select State</option>
                <option value="AL">Alabama</option>
                <option value="AK">Alaska</option>
                <option value="AZ">Arizona</option>
                <option value="AR">Arkansas</option>
                <option value="CA">California</option>
                <option value="CO">Colorado</option>
                <option value="CT">Connecticut</option>
                <option value="DE">Delaware</option>
                <option value="FL">Florida</option>
                <option value="GA">Georgia</option>
                <option value="HI">Hawaii</option>
                <option value="ID">Idaho</option>
                <option value="IL">Illinois</option>
                <option value="IN">Indiana</option>
                <option value="IA">Iowa</option>
                <option value="KS">Kansas</option>
                <option value="KY">Kentucky</option>
                <option value="LA">Louisiana</option>
                <option value="ME">Maine</option>
                <option value="MD">Maryland</option>
                <option value="MA">Massachusetts</option>
                <option value="MI">Michigan</option>
                <option value="MN">Minnesota</option>
                <option value="MS">Mississippi</option>
                <option value="MO">Missouri</option>
                <option value="MT">Montana</option>
                <option value="NE">Nebraska</option>
                <option value="NV">Nevada</option>
                <option value="NH">New Hampshire</option>
                <option value="NJ">New Jersey</option>
                <option value="NM">New Mexico</option>
                <option value="NY">New York</option>
                <option value="NC">North Carolina</option>
                <option value="ND">North Dakota</option>
                <option value="OH">Ohio</option>
                <option value="OK">Oklahoma</option>
                <option value="OR">Oregon</option>
                <option value="PA">Pennsylvania</option>
                <option value="RI">Rhode Island</option>
                <option value="SC">South Carolina</option>
                <option value="SD">South Dakota</option>
                <option value="TN">Tennessee</option>
                <option value="TX">Texas</option>
                <option value="UT">Utah</option>
                <option value="VT">Vermont</option>
                <option value="VA">Virginia</option>
                <option value="WA">Washington</option>
                <option value="WV">West Virginia</option>
                <option value="WI">Wisconsin</option>
                <option value="WY">Wyoming</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Auction Type
              </label>
              <select
                className="input-field mt-1"
                value={config.auctionType}
                onChange={(e) => updateConfig('auctionType', e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="foreclosure">Foreclosure</option>
                <option value="bankruptcy">Bankruptcy</option>
                <option value="tax">Tax Sale</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Pages
              </label>
              <input
                type="number"
                className="input-field mt-1"
                value={config.maxPages}
                onChange={(e) => updateConfig('maxPages', parseInt(e.target.value))}
                min={1}
                max={10}
              />
              <p className="text-xs text-gray-500 mt-1">More pages = more results but takes longer</p>
            </div>
            
            <div className="flex items-center mt-4">
              <label className="block text-sm font-medium text-gray-700 mr-3" title="Enhanced version uses advanced anti-detection measures but may run slower. Standard version is faster but more easily detected.">
                Use Enhanced Version
                <span className="ml-1 text-xs text-blue-500 cursor-help">ℹ️</span>
              </label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  id="auction-toggle"
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                  checked={config.useEnhanced}
                  onChange={(e) => updateConfig('useEnhanced', e.target.checked as any)}
                />
                <label
                  htmlFor="auction-toggle"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
              <span className="text-xs text-gray-600">
                {config.useEnhanced ? '🚀 Enhanced' : '📄 Standard'}
              </span>
            </div>
          </>
        );

      case 'county':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                State
              </label>
              <select
                className="input-field mt-1"
                value={config.state}
                onChange={(e) => updateConfig('state', e.target.value)}
              >
                <option value="">Select State</option>
                <option value="AZ">Arizona</option>
                <option value="CA">California</option>
                <option value="FL">Florida</option>
                <option value="TX">Texas</option>
                {/* Add more states as needed */}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                County
              </label>
              <input
                type="text"
                className="input-field mt-1"
                placeholder="Maricopa"
                value={config.county}
                onChange={(e) => updateConfig('county', e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date Range (days)
              </label>
              <select
                className="input-field mt-1"
                value={config.dateRange}
                onChange={(e) => updateConfig('dateRange', e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
      <p className="text-gray-600 mb-4">
        {description}
      </p>
      
      <div className="space-y-4">
        {renderConfigFields()}
        
        <button 
          className="btn-primary w-full"
          onClick={startScraping}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : '🔍'} {isLoading ? 'Starting...' : 'Start Scraping'}
        </button>
      </div>
    </div>
  );
};
