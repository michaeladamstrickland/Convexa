import React, { useState } from 'react';
import { ScraperConfigPanel } from './ScraperConfigPanel';
import { ScraperJobsList } from './ScraperJobsList';

/**
 * Main Scraper component that integrates all scraper-related functionality
 */
export const Scraper: React.FC = () => {
  const [refreshJobsListKey, setRefreshJobsListKey] = useState<number>(0);
  
  const refreshJobsList = () => {
    setRefreshJobsListKey(prev => prev + 1);
  };
  
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Property Data Scraper</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ScraperConfigPanel onJobStarted={refreshJobsList} />
        </div>
        
        <div className="lg:col-span-2">
          <ScraperJobsList key={refreshJobsListKey} limit={10} showRefresh={true} />
        </div>
      </div>
    </div>
  );
};
