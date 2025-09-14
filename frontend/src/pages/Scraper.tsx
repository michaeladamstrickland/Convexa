import { useState } from 'react';
import { ScraperConfigPanel } from '../components/scrapers/ScraperConfigPanel';
import { ScraperJobsList } from '../components/scrapers/ScraperJobsList';
import { ScraperScheduler } from '../components/scrapers/ScraperScheduler';

export default function Scraper() {
  // State to trigger refresh of job list when a new job is started
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'manual' | 'scheduled' | 'jobs'>('manual');

  const handleJobStarted = () => {
    // Increment the refresh trigger to force job list update
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Property Scrapers</h1>
        <div className="text-sm text-gray-500">
          Real-time data collection system
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manual'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('manual')}
          >
            Manual Scraping
          </button>
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scheduled'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('scheduled')}
          >
            Scheduled Scraping
          </button>
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'jobs'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('jobs')}
          >
            Job History
          </button>
        </nav>
      </div>

      {/* Manual scraping tab */}
      {activeTab === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ScraperConfigPanel
            scraperType="zillow"
            title="Zillow FSBO Scraper"
            description="Find motivated For Sale By Owner (FSBO) sellers directly from Zillow."
            onJobStarted={handleJobStarted}
          />
          
          <ScraperConfigPanel
            scraperType="auction"
            title="Auction Site Scraper"
            description="Discover properties from auction sites including foreclosures and bank-owned."
            onJobStarted={handleJobStarted}
          />
          
          <ScraperConfigPanel
            scraperType="county"
            title="County Records Scraper"
            description="Extract properties from county public records including tax liens and probates."
            onJobStarted={handleJobStarted}
          />
        </div>
      )}

      {/* Scheduled scraping tab */}
      {activeTab === 'scheduled' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScraperScheduler />
          
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Scheduled Jobs</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Run
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      Zillow FSBO
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      Daily at 02:00
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      Sep 10, 2025 02:00
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      County Probate
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      Weekly on Monday at 04:00
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      Sep 15, 2025 04:00
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Job history tab */}
      {activeTab === 'jobs' && (
        <div>
          <ScraperJobsList triggerRefresh={refreshTrigger} />
        </div>
      )}
      
      {/* Dashboard statistics (shown on all tabs) */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-blue-50 border border-blue-100">
          <div className="text-center">
            <p className="text-blue-800 text-2xl font-bold">24</p>
            <p className="text-blue-600 text-sm">Active Data Sources</p>
          </div>
        </div>
        <div className="card bg-green-50 border border-green-100">
          <div className="text-center">
            <p className="text-green-800 text-2xl font-bold">1,843</p>
            <p className="text-green-600 text-sm">Properties Found (30d)</p>
          </div>
        </div>
        <div className="card bg-purple-50 border border-purple-100">
          <div className="text-center">
            <p className="text-purple-800 text-2xl font-bold">342</p>
            <p className="text-purple-600 text-sm">Leads Generated (30d)</p>
          </div>
        </div>
        <div className="card bg-amber-50 border border-amber-100">
          <div className="text-center">
            <p className="text-amber-800 text-2xl font-bold">18.6%</p>
            <p className="text-amber-600 text-sm">Conversion Rate</p>
          </div>
        </div>
      </div>
      
      {/* System status (shown on all tabs) */}
      <div className="card mt-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Real-time Scraper System</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 mr-1 bg-green-500 rounded-full"></span>
              Operational
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Proxy Rotation System</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 mr-1 bg-green-500 rounded-full"></span>
              Operational
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Data Processing Pipeline</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 mr-1 bg-green-500 rounded-full"></span>
              Operational
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
