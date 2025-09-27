import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Spinner } from '../common/Spinner';
import { scraperApi } from '../../services/scraperApi';
/**
 * Component for scheduling recurring scraper jobs
 */
export const ScraperScheduler = ({ refreshJobsList }) => {
    const [schedules, setSchedules] = useState([]);
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
            }
            else {
                console.error('Invalid response format:', response.data);
                toast.error('Failed to load schedules');
            }
        }
        catch (error) {
            console.error('Error fetching schedules:', error);
            toast.error('Failed to load schedules');
        }
        finally {
            setLoading(false);
        }
    };
    const addSchedule = async () => {
        try {
            let configObj;
            try {
                configObj = JSON.parse(newSchedule.config);
            }
            catch (e) {
                toast.error('Invalid JSON configuration');
                return;
            }
            const response = await scraperApi.createSchedule({
                source: newSchedule.source,
                frequency: newSchedule.frequency,
                config: configObj
            });
            if (response.data.success) {
                toast.success('Schedule added successfully');
                setShowAddModal(false);
                fetchSchedules();
            }
            else {
                toast.error('Failed to add schedule');
            }
        }
        catch (error) {
            console.error('Error adding schedule:', error);
            toast.error('Failed to add schedule');
        }
    };
    const toggleScheduleActive = async (id, currentActive) => {
        try {
            const response = await scraperApi.updateSchedule(id, {
                active: !currentActive
            });
            if (response.data.success) {
                toast.success(`Schedule ${!currentActive ? 'activated' : 'deactivated'}`);
                fetchSchedules();
            }
            else {
                toast.error('Failed to update schedule');
            }
        }
        catch (error) {
            console.error('Error updating schedule:', error);
            toast.error('Failed to update schedule');
        }
    };
    const deleteSchedule = async (id) => {
        try {
            const response = await scraperApi.deleteSchedule(id);
            if (response.data.success) {
                toast.success('Schedule deleted');
                fetchSchedules();
            }
            else {
                toast.error('Failed to delete schedule');
            }
        }
        catch (error) {
            console.error('Error deleting schedule:', error);
            toast.error('Failed to delete schedule');
        }
    };
    const runScheduleNow = async (id, source) => {
        try {
            const response = await scraperApi.runScheduleNow(id);
            if (response.data.success) {
                toast.success(`${capitalizeFirstLetter(source)} scraper started`);
                if (refreshJobsList) {
                    refreshJobsList();
                }
            }
            else {
                toast.error('Failed to run scraper');
            }
        }
        catch (error) {
            console.error('Error running scraper:', error);
            toast.error('Failed to run scraper');
        }
    };
    const handleSourceChange = (source) => {
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
    return (_jsxs("div", { className: "bg-white shadow-md rounded-lg p-4", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Scheduled Scraping Jobs" }), _jsx("button", { onClick: () => setShowAddModal(true), className: "px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm", children: "Add Schedule" })] }), loading ? (_jsx("div", { className: "flex justify-center py-10", children: _jsx(Spinner, { size: "lg" }) })) : schedules.length === 0 ? (_jsx("div", { className: "text-center py-10 text-gray-500", children: "No scheduled jobs found" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-2", children: "Source" }), _jsx("th", { className: "px-4 py-2", children: "Frequency" }), _jsx("th", { className: "px-4 py-2", children: "Last Run" }), _jsx("th", { className: "px-4 py-2", children: "Next Run" }), _jsx("th", { className: "px-4 py-2", children: "Status" }), _jsx("th", { className: "px-4 py-2", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: schedules.map(schedule => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-4 py-2", children: capitalizeFirstLetter(schedule.source) }), _jsx("td", { className: "px-4 py-2", children: capitalizeFirstLetter(schedule.frequency) }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-600", children: schedule.lastRun
                                            ? new Date(schedule.lastRun).toLocaleString()
                                            : 'Never' }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-600", children: schedule.nextRun && schedule.active
                                            ? new Date(schedule.nextRun).toLocaleString()
                                            : '-' }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs ${schedule.active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'}`, children: schedule.active ? 'Active' : 'Inactive' }) }), _jsx("td", { className: "px-4 py-2", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => runScheduleNow(schedule.id, schedule.source), className: "px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs", children: "Run Now" }), _jsx("button", { onClick: () => toggleScheduleActive(schedule.id, schedule.active), className: `px-2 py-1 rounded text-xs ${schedule.active
                                                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                                        : 'bg-green-100 text-green-700 hover:bg-green-200'}`, children: schedule.active ? 'Deactivate' : 'Activate' }), _jsx("button", { onClick: () => deleteSchedule(schedule.id), className: "px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs", children: "Delete" })] }) })] }, schedule.id))) })] }) })), showAddModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg max-w-lg w-full", children: [_jsx("div", { className: "p-4 border-b", children: _jsx("h3", { className: "text-lg font-semibold", children: "Add Scheduled Scraper" }) }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Data Source" }), _jsx("select", { className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: newSchedule.source, onChange: (e) => handleSourceChange(e.target.value), children: sources.map(source => (_jsx("option", { value: source, children: capitalizeFirstLetter(source) }, source))) })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Frequency" }), _jsx("select", { className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: newSchedule.frequency, onChange: (e) => setNewSchedule({ ...newSchedule, frequency: e.target.value }), children: frequencies.map(freq => (_jsx("option", { value: freq.value, children: freq.label }, freq.value))) })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Configuration (JSON)" }), _jsx("textarea", { className: "w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm h-48", value: newSchedule.config, onChange: (e) => setNewSchedule({ ...newSchedule, config: e.target.value }) }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Enter the scraper configuration in JSON format" })] })] }), _jsxs("div", { className: "p-4 border-t flex justify-end space-x-2", children: [_jsx("button", { onClick: () => setShowAddModal(false), className: "px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300", children: "Cancel" }), _jsx("button", { onClick: addSchedule, className: "px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600", children: "Add Schedule" })] })] }) }))] }));
};
// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
//# sourceMappingURL=ScraperScheduler.js.map