import { useState, FC } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Spinner } from '../ui/Spinner';

interface ScheduleConfig {
  isEnabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time: string;
  day?: string;
  sources: string[];
  zipCodes: string;
}

export const ScraperScheduler: FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    isEnabled: false,
    frequency: 'daily',
    time: '02:00',
    day: 'monday',
    sources: ['zillow_fsbo'],
    zipCodes: '07001, 07002, 07003'
  });

  // Update schedule configuration
  const updateScheduleConfig = (field: keyof ScheduleConfig, value: any) => {
    setScheduleConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Toggle source selection
  const toggleSource = (source: string) => {
    setScheduleConfig(prev => {
      const currentSources = [...prev.sources];
      
      if (currentSources.includes(source)) {
        // Remove source if already selected
        return {
          ...prev,
          sources: currentSources.filter(s => s !== source)
        };
      } else {
        // Add source if not selected
        return {
          ...prev,
          sources: [...currentSources, source]
        };
      }
    });
  };

  // Save schedule configuration
  const saveSchedule = async () => {
    setIsLoading(true);
    
    try {
      const response = await axios.post('/api/scraper/schedule', scheduleConfig);
      
      if (response.data.success) {
        toast.success('Scraping schedule updated successfully');
      } else {
        toast.error('Failed to update scraping schedule');
      }
    } catch (error) {
      console.error('Error saving scraping schedule:', error);
      toast.error('Failed to save scraping schedule');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Automated Scraping Schedule</h2>
      <p className="text-gray-600 mb-4">
        Configure automated scraping jobs to run on a schedule.
      </p>
      
      <div className="space-y-4">
        <div className="flex items-center">
          <div className="form-control">
            <label className="cursor-pointer label justify-start">
              <input 
                type="checkbox" 
                className="toggle toggle-primary" 
                checked={scheduleConfig.isEnabled}
                onChange={e => updateScheduleConfig('isEnabled', e.target.checked)}
              />
              <span className="label-text ml-2 font-medium">Enable Scheduled Scraping</span> 
            </label>
          </div>
        </div>
        
        <div className={scheduleConfig.isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frequency
              </label>
              <select
                className="input-field w-full"
                value={scheduleConfig.frequency}
                onChange={e => updateScheduleConfig('frequency', e.target.value)}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <input
                type="time"
                className="input-field w-full"
                value={scheduleConfig.time}
                onChange={e => updateScheduleConfig('time', e.target.value)}
                disabled={scheduleConfig.frequency === 'hourly'}
              />
            </div>
          </div>
          
          {scheduleConfig.frequency === 'weekly' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day of Week
              </label>
              <select
                className="input-field w-full"
                value={scheduleConfig.day}
                onChange={e => updateScheduleConfig('day', e.target.value)}
              >
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          )}
          
          {scheduleConfig.frequency === 'monthly' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day of Month
              </label>
              <select
                className="input-field w-full"
                value={scheduleConfig.day}
                onChange={e => updateScheduleConfig('day', e.target.value)}
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={`${i + 1}`}>{i + 1}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Sources
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="source-zillow"
                  className="mr-2"
                  checked={scheduleConfig.sources.includes('zillow_fsbo')}
                  onChange={() => toggleSource('zillow_fsbo')}
                />
                <label htmlFor="source-zillow">Zillow FSBO</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="source-auction"
                  className="mr-2"
                  checked={scheduleConfig.sources.includes('auction_com')}
                  onChange={() => toggleSource('auction_com')}
                />
                <label htmlFor="source-auction">Auction.com</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="source-hubzu"
                  className="mr-2"
                  checked={scheduleConfig.sources.includes('hubzu')}
                  onChange={() => toggleSource('hubzu')}
                />
                <label htmlFor="source-hubzu">Hubzu</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="source-county-probate"
                  className="mr-2"
                  checked={scheduleConfig.sources.includes('county_probate')}
                  onChange={() => toggleSource('county_probate')}
                />
                <label htmlFor="source-county-probate">County Probate</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="source-county-tax"
                  className="mr-2"
                  checked={scheduleConfig.sources.includes('county_tax')}
                  onChange={() => toggleSource('county_tax')}
                />
                <label htmlFor="source-county-tax">County Tax</label>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zip Codes (comma separated)
            </label>
            <input
              type="text"
              className="input-field w-full"
              value={scheduleConfig.zipCodes}
              onChange={e => updateScheduleConfig('zipCodes', e.target.value)}
              placeholder="07001, 07002, 07003"
            />
            <p className="text-xs text-gray-500 mt-1">
              Target areas for scraping, separated by commas
            </p>
          </div>
        </div>
        
        <button 
          className="btn-primary w-full"
          onClick={saveSchedule}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : '📅'} {isLoading ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>
    </div>
  );
};
