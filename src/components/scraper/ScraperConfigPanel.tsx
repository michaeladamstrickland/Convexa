import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Spinner } from '../common/Spinner';
import { scraperApi } from '../../services/scraperApi';

interface ScraperConfigPanelProps {
  onJobStarted?: () => void;
}

/**
 * Component for configuring and starting scraper jobs
 */
export const ScraperConfigPanel: React.FC<ScraperConfigPanelProps> = ({ onJobStarted }) => {
  const [selectedSource, setSelectedSource] = useState<string>('zillow');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);
  const [config, setConfig] = useState<Record<string, any>>({
    zillow: {
      location: 'San Diego, CA',
      propertyTypes: ['house', 'condo'],
      minPrice: 300000,
      maxPrice: 1000000,
      minBeds: 2,
      minBaths: 2,
      maxResults: 50
    },
    auction: {
      state: 'California',
      county: 'San Diego',
      daysAhead: 30,
      maxResults: 50
    },
    county: {
      state: 'California',
      county: 'San Diego',
      recordTypes: ['deed', 'foreclosure', 'tax_lien'],
      daysBack: 30,
      maxResults: 100
    }
  });

  const startScraper = async () => {
    try {
      setIsLoading(true);
      
      const response = await scraperApi.startScraper(selectedSource, config[selectedSource]);
      
      if (response.data && response.data.success) {
        toast.success(`${capitalizeFirstLetter(selectedSource)} scraper started successfully`);
        if (onJobStarted) {
          onJobStarted();
        }
      } else {
        toast.error(`Failed to start ${selectedSource} scraper`);
      }
    } catch (error: any) {
      console.error('Error starting scraper:', error);
      toast.error(`Error starting ${selectedSource} scraper: ${error?.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [selectedSource]: {
        ...prev[selectedSource],
        [key]: value
      }
    }));
  };

  const renderZillowForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="col-span-1 md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.zillow.location}
          onChange={(e) => handleConfigChange('location', e.target.value)}
          placeholder="City, State or ZIP code"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.zillow.minPrice}
          onChange={(e) => handleConfigChange('minPrice', parseInt(e.target.value))}
          placeholder="Min Price"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.zillow.maxPrice}
          onChange={(e) => handleConfigChange('maxPrice', parseInt(e.target.value))}
          placeholder="Max Price"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Min Beds</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.zillow.minBeds}
          onChange={(e) => handleConfigChange('minBeds', parseInt(e.target.value))}
          placeholder="Min Bedrooms"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Min Baths</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.zillow.minBaths}
          onChange={(e) => handleConfigChange('minBaths', parseInt(e.target.value))}
          placeholder="Min Bathrooms"
        />
      </div>
      {advancedMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={config.zillow.maxResults}
            onChange={(e) => handleConfigChange('maxResults', parseInt(e.target.value))}
            placeholder="Max Results"
          />
        </div>
      )}
    </div>
  );

  const renderAuctionForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.auction.state}
          onChange={(e) => handleConfigChange('state', e.target.value)}
          placeholder="State"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.auction.county}
          onChange={(e) => handleConfigChange('county', e.target.value)}
          placeholder="County"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Days Ahead</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.auction.daysAhead}
          onChange={(e) => handleConfigChange('daysAhead', parseInt(e.target.value))}
          placeholder="Days Ahead"
        />
      </div>
      {advancedMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={config.auction.maxResults}
            onChange={(e) => handleConfigChange('maxResults', parseInt(e.target.value))}
            placeholder="Max Results"
          />
        </div>
      )}
    </div>
  );

  const renderCountyForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.county.state}
          onChange={(e) => handleConfigChange('state', e.target.value)}
          placeholder="State"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.county.county}
          onChange={(e) => handleConfigChange('county', e.target.value)}
          placeholder="County"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Days Back</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={config.county.daysBack}
          onChange={(e) => handleConfigChange('daysBack', parseInt(e.target.value))}
          placeholder="Days Back"
        />
      </div>
      {advancedMode && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Record Types</label>
            <select
              multiple
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={config.county.recordTypes}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                handleConfigChange('recordTypes', selected);
              }}
            >
              <option value="deed">Deeds</option>
              <option value="foreclosure">Foreclosures</option>
              <option value="tax_lien">Tax Liens</option>
              <option value="mortgage">Mortgages</option>
              <option value="notice_default">Notices of Default</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={config.county.maxResults}
              onChange={(e) => handleConfigChange('maxResults', parseInt(e.target.value))}
              placeholder="Max Results"
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Start New Scraper</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
        <div className="flex space-x-2">
          <button
            className={`px-4 py-2 rounded-md ${selectedSource === 'zillow' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setSelectedSource('zillow')}
          >
            Zillow
          </button>
          <button
            className={`px-4 py-2 rounded-md ${selectedSource === 'auction' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setSelectedSource('auction')}
          >
            Auctions
          </button>
          <button
            className={`px-4 py-2 rounded-md ${selectedSource === 'county' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setSelectedSource('county')}
          >
            County Records
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        {selectedSource === 'zillow' && renderZillowForm()}
        {selectedSource === 'auction' && renderAuctionForm()}
        {selectedSource === 'county' && renderCountyForm()}
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="advancedMode"
            checked={advancedMode}
            onChange={() => setAdvancedMode(!advancedMode)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="advancedMode" className="ml-2 text-sm text-gray-700">
            Advanced Options
          </label>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={startScraper}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Spinner size="sm" /> : `Start ${capitalizeFirstLetter(selectedSource)} Scraper`}
        </button>
      </div>
    </div>
  );
};

// Helper function to capitalize first letter
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
