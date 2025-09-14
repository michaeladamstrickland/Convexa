import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useScraperWebSocket } from '../../hooks/useScraperWebSocket';
import { Spinner } from '../common/Spinner';
import toast from 'react-hot-toast';
import { scraperApi } from '../../services/scraperApi';

interface ScrapingJob {
  id: string;
  source: string;
  status: string;
  config: string;
  startedAt: string;
  completedAt?: string;
  logs?: string;
  resultsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ScraperJobsListProps {
  limit?: number;
  showRefresh?: boolean;
}

/**
 * Component for displaying a list of scraping jobs with real-time updates
 */
export const ScraperJobsList: React.FC<ScraperJobsListProps> = ({ 
  limit = 10,
  showRefresh = true 
}) => {
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ScrapingJob | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Connect to WebSocket for real-time updates
  const { isConnected, jobUpdates } = useScraperWebSocket();

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await scraperApi.getJobs({ 
        limit, 
        page: 1 
      });
      
      if (response.data.success && Array.isArray(response.data.data.jobs)) {
        setJobs(response.data.data.jobs);
      } else {
        console.error('Invalid response format:', response.data);
        toast.error('Failed to load scraping jobs');
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load scraping jobs');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, []);

  // Handle job updates from WebSocket
  useEffect(() => {
    if (jobUpdates.length > 0) {
      const latestUpdate = jobUpdates[0];
      
      // Fetch the latest job data to ensure we have the most up-to-date information
      if (latestUpdate?.job?.id) {
        scraperApi.getJobById(latestUpdate.job.id)
          .then((response: any) => {
            if (response.data.success) {
              // Update the job in our list
              setJobs(prevJobs => {
                const updatedJobs = [...prevJobs];
                const index = updatedJobs.findIndex(job => job.id === latestUpdate.job.id);
                
                if (index !== -1) {
                  // Update existing job
                  updatedJobs[index] = response.data.data;
                } else {
                  // Add new job at the beginning
                  updatedJobs.unshift(response.data.data);
                  // Keep within limit
                  if (updatedJobs.length > limit) {
                    updatedJobs.pop();
                  }
                }
                
                return updatedJobs;
              });
              
              // Show toast notification
              if (latestUpdate.action === 'job_completed') {
                toast.success(`${capitalizeFirstLetter(latestUpdate.job.source)} scraping job completed`);
              } else if (latestUpdate.action === 'job_failed') {
                toast.error(`${capitalizeFirstLetter(latestUpdate.job.source)} scraping job failed`);
              }
            }
          })
          .catch((error: any) => {
            console.error('Error fetching updated job:', error);
          });
      }
    }
  }, [jobUpdates, limit]);

  const handleRefresh = () => {
    fetchJobs();
    toast.success('Jobs refreshed');
  };

  const viewJobDetails = (job: ScrapingJob) => {
    setSelectedJob(job);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedJob(null);
  };

  const processRecords = async (jobId: string) => {
    try {
      toast.loading('Processing records...');
      const response = await scraperApi.processRecords(jobId);
      
      if (response.data.success) {
        toast.dismiss();
        toast.success(`Processed ${response.data.data.processedCount} records`);
      } else {
        toast.dismiss();
        toast.error('Failed to process records');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error processing records:', error);
      toast.error('Failed to process records');
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Recent Scraping Jobs</h2>
        <div className="flex items-center">
          {isConnected && (
            <span className="inline-flex items-center mr-3 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              Live
            </span>
          )}
          {showRefresh && (
            <button 
              onClick={handleRefresh}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : 'Refresh'}
            </button>
          )}
        </div>
      </div>
      
      {loading && jobs.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No scraping jobs found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Results</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {capitalizeFirstLetter(job.source)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-2">
                    {job.resultsCount !== undefined ? job.resultsCount : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {formatTime(job.startedAt)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {job.completedAt 
                      ? calculateDuration(job.startedAt, job.completedAt)
                      : job.status === 'pending' || job.status === 'running'
                        ? 'Running...'
                        : '-'
                    }
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => viewJobDetails(job)}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
                      >
                        Details
                      </button>
                      {job.status === 'completed' && (
                        <button 
                          onClick={() => processRecords(job.id)}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs"
                        >
                          Process
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {showModal && selectedJob && (
        <JobDetailsModal 
          job={selectedJob} 
          onClose={closeModal} 
          onProcess={() => processRecords(selectedJob.id)}
        />
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  
  switch (status.toLowerCase()) {
    case 'completed':
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
      break;
    case 'failed':
      bgColor = 'bg-red-100';
      textColor = 'text-red-800';
      break;
    case 'running':
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
      break;
    case 'pending':
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-800';
      break;
  }
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${bgColor} ${textColor}`}>
      {capitalizeFirstLetter(status)}
    </span>
  );
};

interface JobDetailsModalProps {
  job: ScrapingJob;
  onClose: () => void;
  onProcess: () => void;
}

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ job, onClose, onProcess }) => {
  const configObj = JSON.parse(job.config || '{}');
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Scraping Job Details</h2>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-gray-500 text-sm">ID</span>
              <p className="font-mono text-xs">{job.id}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Source</span>
              <p>{capitalizeFirstLetter(job.source)}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Status</span>
              <p><StatusBadge status={job.status} /></p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Results</span>
              <p>{job.resultsCount !== undefined ? job.resultsCount : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Started At</span>
              <p>{new Date(job.startedAt).toLocaleString()}</p>
            </div>
            {job.completedAt && (
              <div>
                <span className="text-gray-500 text-sm">Completed At</span>
                <p>{new Date(job.completedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <h3 className="text-gray-500 text-sm mb-1">Configuration</h3>
            <div className="bg-gray-50 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto">
              <pre>{JSON.stringify(configObj, null, 2)}</pre>
            </div>
          </div>
          
          {job.logs && (
            <div className="mb-4">
              <h3 className="text-gray-500 text-sm mb-1">Logs</h3>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto">
                {job.logs}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t flex justify-end space-x-2">
          {job.status === 'completed' && (
            <button
              onClick={onProcess}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Process Records
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateString;
  }
}

function calculateDuration(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMs = endDate.getTime() - startDate.getTime();
    
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    } else if (durationMs < 60000) {
      return `${Math.round(durationMs / 1000)}s`;
    } else if (durationMs < 3600000) {
      return `${Math.round(durationMs / 60000)}m`;
    } else {
      return `${Math.round(durationMs / 3600000)}h ${Math.round((durationMs % 3600000) / 60000)}m`;
    }
  } catch {
    return '-';
  }
}
