import { useState, useEffect, FC } from 'react';
import { formatDistanceToNow } from 'date-fns';
import axios from 'axios';
import { Spinner } from '../ui/Spinner';
import { toast } from 'react-hot-toast';

interface ScraperJob {
  id: string;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  config: string;
  results?: number;
}

interface ScraperJobsListProps {
  triggerRefresh: number;
}

export const ScraperJobsList: FC<ScraperJobsListProps> = ({ triggerRefresh }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ScraperJob | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // Fetch scraping jobs on component mount and when triggerRefresh changes
  useEffect(() => {
    fetchScrapingJobs();
    
    // Set up polling for real-time updates
    const interval = window.setInterval(() => {
      if (!isLoading) {
        fetchScrapingJobs(true);
      }
    }, 10000); // Refresh every 10 seconds
    
    setRefreshInterval(interval);
    
    // Clean up interval on component unmount
    return () => {
      if (refreshInterval) {
        window.clearInterval(refreshInterval);
      }
    };
  }, [triggerRefresh]);

  // Fetch scraping jobs from API
  const fetchScrapingJobs = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const response = await axios.get('/api/scraper/jobs', {
        params: {
          limit: 10, // Get the last 10 jobs
          page: 1,
        },
      });
      
      if (response.data.success) {
        setJobs(response.data.data.jobs);
      }
    } catch (error) {
      console.error('Failed to fetch scraping jobs:', error);
      if (!silent) {
        toast.error('Failed to load scraping history');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // View job details
  const viewJobDetails = async (job: ScraperJob) => {
    setSelectedJob(job);
    setShowDetails(true);
    
    try {
      // Fetch full job details if needed
      const response = await axios.get(`/api/scraper/jobs/${job.id}`);
      if (response.data.success) {
        setSelectedJob(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch job details:', error);
      toast.error('Failed to load job details');
    }
  };

  // Process found properties from a job (convert them to leads)
  const processJobResults = async (jobId: string) => {
    try {
      const response = await axios.post(`/api/scraper/process-records`, {
        jobId
      });
      
      if (response.data.success) {
        toast.success(`Processed ${response.data.data.processedCount} properties into leads`);
        fetchScrapingJobs();
      } else {
        toast.error('Failed to process properties');
      }
    } catch (error) {
      console.error('Failed to process job results:', error);
      toast.error('Failed to process properties into leads');
    }
  };

  // Get the count of found properties for a job
  const getPropertyCount = (job: ScraperJob): number => {
    try {
      if (job.results) {
        return job.results;
      }
      
      // Try to parse from the config
      const config = JSON.parse(job.config || '{}');
      return config.foundProperties || 0;
    } catch (error) {
      return 0;
    }
  };

  // Format job date for display
  const formatJobDate = (dateString: string): string => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown date';
    }
  };

  // Get source display name
  const getSourceDisplayName = (source: string, jobConfig?: any): string => {
    const sourceMap: Record<string, string> = {
      'zillow_fsbo': 'Zillow FSBO',
      'auction_com': 'Auction.com',
      'hubzu': 'Hubzu',
      'foreclosure_com': 'Foreclosure.com',
      'county_probate': 'County Probate',
      'county_tax': 'County Tax Records'
    };
    
    let displayName = sourceMap[source] || source;
    
    // Add indicator for enhanced/standard version if config is available
    if (jobConfig && typeof jobConfig === 'object' && 'useEnhanced' in jobConfig) {
      displayName += jobConfig.useEnhanced ? ' 🚀' : ' 📄';
    }
    
    return displayName;
  };

  // Render job details modal
  const renderJobDetails = () => {
    if (!selectedJob) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium">Job Details</h2>
            <button 
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setShowDetails(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium">{getSourceDisplayName(selectedJob.source, selectedJob.config ? JSON.parse(selectedJob.config) : null)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Scraper Version</p>
              <p className="font-medium">
                {selectedJob.config && JSON.parse(selectedJob.config).useEnhanced 
                  ? <span className="text-indigo-600">Enhanced 🚀</span>
                  : <span className="text-gray-600">Standard 📄</span>
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  selectedJob.status === 'completed' 
                    ? 'bg-green-100 text-green-800'
                    : selectedJob.status === 'failed'
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-blue-100 text-blue-800'
                }`}>
                  {selectedJob.status === 'pending' ? 'Queued' : 
                  selectedJob.status === 'running' ? 'Running...' : 
                  selectedJob.status === 'completed' ? 'Completed' : 'Failed'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Started</p>
              <p className="font-medium">{new Date(selectedJob.startedAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="font-medium">
                {selectedJob.completedAt 
                  ? new Date(selectedJob.completedAt).toLocaleString()
                  : 'Not completed'
                }
              </p>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-gray-500">Configuration</p>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(JSON.parse(selectedJob.config || '{}'), null, 2)}
            </pre>
          </div>
          
          {selectedJob.status === 'completed' && (
            <div className="flex justify-end">
              <button 
                className="btn-secondary mr-2"
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>
              <button 
                className="btn-primary"
                onClick={() => processJobResults(selectedJob.id)}
              >
                Process Results
              </button>
            </div>
          )}
          
          {selectedJob.status !== 'completed' && (
            <div className="flex justify-end">
              <button 
                className="btn-secondary"
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Scraping History</h2>
        <button 
          className="p-1 text-sm text-blue-600 hover:text-blue-800" 
          onClick={() => fetchScrapingJobs()}
          disabled={isRefreshing}
        >
          {isRefreshing ? <Spinner size="xs" /> : '🔄'} Refresh
        </button>
      </div>
      
      {isLoading && !jobs.length ? (
        <div className="py-8 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : !jobs.length ? (
        <div className="py-8 text-center text-gray-500">
          No scraping jobs found
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div 
              key={job.id} 
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              onClick={() => viewJobDetails(job)}
            >
              <div>
                <p className="font-medium text-gray-900">
                  {getSourceDisplayName(job.source, job.config ? JSON.parse(job.config) : null)} {formatJobDate(job.startedAt)}
                </p>
                <p className="text-sm text-gray-500">
                  {getPropertyCount(job)} properties found
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  job.status === 'completed' 
                    ? 'bg-green-100 text-green-800'
                    : job.status === 'failed'
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-blue-100 text-blue-800'
                }`}>
                  {job.status === 'pending' ? 'Queued' : 
                  job.status === 'running' ? 'Running...' : 
                  job.status === 'completed' ? 'Completed' : 'Failed'}
                </span>
                <button 
                  className="p-1 text-gray-400 hover:text-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    viewJobDetails(job);
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showDetails && renderJobDetails()}
    </div>
  );
};
