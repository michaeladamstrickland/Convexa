import React, { useState } from 'react';
import { ScraperConfigPanel } from './ScraperConfigPanel';
import { ScraperJobsList } from './ScraperJobsList';
import { ScraperScheduler } from './ScraperScheduler';

/**
 * Main Scraper component that integrates all scraper-related functionality
 */
export const Scraper: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('jobs');
  const [refreshJobsListKey, setRefreshJobsListKey] = useState<number>(0);
  
  const refreshJobsList = () => {
    setRefreshJobsListKey(prev => prev + 1);
  };
  
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Property Data Scraper</h1>
      
      <div className="flex mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('jobs')}
              className={`py-2 px-1 ${
                activeTab === 'jobs'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Jobs
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-2 px-1 ${
                activeTab === 'schedules'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Schedules
            </button>
          </nav>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ScraperConfigPanel onJobStarted={refreshJobsList} />
        </div>
        
        <div className="lg:col-span-2">
          {activeTab === 'jobs' ? (
            <ScraperJobsList key={refreshJobsListKey} limit={10} showRefresh={true} />
          ) : (
            <ScraperScheduler refreshJobsList={refreshJobsList} />
          )}
        </div>
      </div>
    </div>
  );
};
