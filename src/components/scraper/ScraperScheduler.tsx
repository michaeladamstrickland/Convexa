import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Spinner } from '../common/Spinner';
import { scraperApi } from '../../services/scraperApi';

interface ScheduleItem {
  id: string;
  source: string;
  frequency: string;
  config: string;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean; // Fixed: use isActive instead of active
}

interface ScraperSchedulerProps {
  refreshJobsList?: () => void;
}

/**
 * Component for scheduling recurring scraper jobs
 */
export const ScraperScheduler: React.FC<ScraperSchedulerProps> = ({ refreshJobsList }) => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sources] = useState(['zillow', 'auction', 'county']);
  const [frequencies] = useState([
    { label: 'Hourly', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' }
  ]);
  const [newSchedule, setNewSchedule] = useState({
    source: 'zillow',
    frequency: 'daily',
    config: JSON.stringify({
      location: 'San Diego, CA',
      propertyTypes: ['house', 'condo'],
      minPrice: 300000,
      maxPrice: 1000000,
      minBeds: 2,
      minBaths: 2,
      maxResults: 50
    }, null, 2)
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await scraperApi.getSchedules();
      
      if (response.data.success && Array.isArray(response.data.data.schedules)) {
        setSchedules(response.data.data.schedules);
      } else {
        console.error('Invalid response format:', response.data);
        toast.error('Failed to load schedules');
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const addSchedule = async () => {
    try {
      let configObj;
      try {
        configObj = JSON.parse(newSchedule.config);
      } catch (e) {
        toast.error('Invalid JSON configuration');
        return;
      }

      const response = await scraperApi.createSchedule({
        name: `${newSchedule.source}_${newSchedule.frequency}`,
        scraperType: newSchedule.source,
        cronExpression: getCronExpression(newSchedule.frequency),
        config: configObj
      });
      
      if (response.data.success) {
        toast.success('Schedule added successfully');
        setShowAddModal(false);
        fetchSchedules();
      } else {
        toast.error('Failed to add schedule');
      }
    } catch (error) {
      console.error('Error adding schedule:', error);
      toast.error('Failed to add schedule');
    }
  };

  const toggleScheduleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await scraperApi.updateSchedule(id, {
        isActive: !currentActive
      });
      
      if (response.data.success) {
        toast.success(`Schedule ${!currentActive ? 'activated' : 'deactivated'}`);
        fetchSchedules();
      } else {
        toast.error('Failed to update schedule');
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      const response = await scraperApi.deleteSchedule(id);
      
      if (response.data.success) {
        toast.success('Schedule deleted');
        fetchSchedules();
      } else {
        toast.error('Failed to delete schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const runScheduleNow = async (id: string, source: string) => {
    try {
      const response = await scraperApi.runSchedule(id);
      
      if (response.data.success) {
        toast.success(`${capitalizeFirstLetter(source)} scraper started`);
        if (refreshJobsList) {
          refreshJobsList();
        }
      } else {
        toast.error('Failed to run scraper');
      }
    } catch (error) {
      console.error('Error running scraper:', error);
      toast.error('Failed to run scraper');
    }
  };

  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const getCronExpression = (frequency: string): string => {
    switch (frequency) {
      case 'hourly': return '0 * * * *';
      case 'daily': return '0 0 * * *';
      case 'weekly': return '0 0 * * 0';
      case 'monthly': return '0 0 1 * *';
      default: return '0 0 * * *';
    }
  };

  const handleSourceChange = (source: string) => {
    let defaultConfig = {};
    
    switch (source) {
      case 'zillow':
        defaultConfig = {
          location: 'San Diego, CA',
          propertyTypes: ['house', 'condo'],
          minPrice: 300000,
          maxPrice: 1000000,
          minBeds: 2,
          minBaths: 2,
          maxResults: 50
        };
        break;
      case 'auction':
        defaultConfig = {
          location: 'San Diego, CA',
          propertyTypes: ['house', 'condo'],
          maxResults: 50
        };
        break;
      case 'county':
        defaultConfig = {
          county: 'San Diego County',
          maxResults: 50
        };
        break;
    }
    
    setNewSchedule({
      ...newSchedule,
      source,
      config: JSON.stringify(defaultConfig, null, 2)
    });
  };

  const handleSourceChange = (source: string) => {
    let defaultConfig = {};
    
    switch (source) {
      case 'zillow':
        defaultConfig = {
          location: 'San Diego, CA',
          propertyTypes: ['house', 'condo'],
          minPrice: 300000,
          maxPrice: 1000000,
          minBeds: 2,
          minBaths: 2,
          maxResults: 50
        };
        break;
      case 'auction':
        defaultConfig = {
          state: 'California',
          county: 'San Diego',
          daysAhead: 30,
          maxResults: 50
        };
        break;
      case 'county':
        defaultConfig = {
          state: 'California',
          county: 'San Diego',
          recordTypes: ['deed', 'foreclosure', 'tax_lien'],
          daysBack: 30,
          maxResults: 100
        };
        break;
    }
    
    setNewSchedule({
      ...newSchedule,
      source,
      config: JSON.stringify(defaultConfig, null, 2)
    });
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Scheduled Scraping Jobs</h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
        >
          Add Schedule
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          const response = await scraperApi.createSchedule({
            source: newSchedule.source,
            frequency: newSchedule.frequency,
            config: configObj,
            isActive: true // default to active on creation
          });
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Frequency</th>
                <th className="px-4 py-2">Last Run</th>
                <th className="px-4 py-2">Next Run</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {schedules.map(schedule => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {capitalizeFirstLetter(schedule.source)}
                  </td>
                  <td className="px-4 py-2">
                    {capitalizeFirstLetter(schedule.frequency)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {schedule.lastRun 
                      ? new Date(schedule.lastRun).toLocaleString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {schedule.nextRun && schedule.active
                      ? new Date(schedule.nextRun).toLocaleString()
                      : '-'
                    }
                  </td>
                  <td className="px-4 py-2">
                    <span 
                      className={`px-2 py-1 rounded-full text-xs ${
                        schedule.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {schedule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => runScheduleNow(schedule.id, schedule.source)}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                      >
                        Run Now
                      </button>
                      <button 
                        onClick={() => toggleScheduleActive(schedule.id, schedule.active)}
                        className={`px-2 py-1 rounded text-xs ${
                          schedule.active
                            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {schedule.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button 
                        onClick={() => deleteSchedule(schedule.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Add Scheduled Scraper</h3>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newSchedule.source}
                  onChange={(e) => handleSourceChange(e.target.value)}
                >
                  {sources.map(source => (
                    <option key={source} value={source}>
                      {capitalizeFirstLetter(source)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newSchedule.frequency}
                  onChange={(e) => setNewSchedule({...newSchedule, frequency: e.target.value})}
                >
                  {frequencies.map(freq => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Configuration (JSON)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm h-48"
                  value={newSchedule.config}
                  onChange={(e) => setNewSchedule({...newSchedule, config: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the scraper configuration in JSON format
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end space-x-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={addSchedule}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Add Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to capitalize first letter
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
