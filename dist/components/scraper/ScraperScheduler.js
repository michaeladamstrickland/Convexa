"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperScheduler = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_hot_toast_1 = __importDefault(require("react-hot-toast"));
const Spinner_1 = require("../common/Spinner");
const scraperApi_1 = require("../../services/scraperApi");
/**
 * Component for scheduling recurring scraper jobs
 */
const ScraperScheduler = ({ refreshJobsList }) => {
    const [schedules, setSchedules] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [showAddModal, setShowAddModal] = (0, react_1.useState)(false);
    const [sources] = (0, react_1.useState)(['zillow', 'auction', 'county']);
    const [frequencies] = (0, react_1.useState)([
        { label: 'Hourly', value: 'hourly' },
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' }
    ]);
    const [newSchedule, setNewSchedule] = (0, react_1.useState)({
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
    (0, react_1.useEffect)(() => {
        fetchSchedules();
    }, []);
    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const response = await scraperApi_1.scraperApi.getSchedules();
            if (response.data.success && Array.isArray(response.data.data.schedules)) {
                setSchedules(response.data.data.schedules);
            }
            else {
                console.error('Invalid response format:', response.data);
                react_hot_toast_1.default.error('Failed to load schedules');
            }
        }
        catch (error) {
            console.error('Error fetching schedules:', error);
            react_hot_toast_1.default.error('Failed to load schedules');
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
                react_hot_toast_1.default.error('Invalid JSON configuration');
                return;
            }
            const response = await scraperApi_1.scraperApi.createSchedule({
                source: newSchedule.source,
                frequency: newSchedule.frequency,
                config: configObj
            });
            if (response.data.success) {
                react_hot_toast_1.default.success('Schedule added successfully');
                setShowAddModal(false);
                fetchSchedules();
            }
            else {
                react_hot_toast_1.default.error('Failed to add schedule');
            }
        }
        catch (error) {
            console.error('Error adding schedule:', error);
            react_hot_toast_1.default.error('Failed to add schedule');
        }
    };
    const toggleScheduleActive = async (id, currentActive) => {
        try {
            const response = await scraperApi_1.scraperApi.updateSchedule(id, {
                active: !currentActive
            });
            if (response.data.success) {
                react_hot_toast_1.default.success(`Schedule ${!currentActive ? 'activated' : 'deactivated'}`);
                fetchSchedules();
            }
            else {
                react_hot_toast_1.default.error('Failed to update schedule');
            }
        }
        catch (error) {
            console.error('Error updating schedule:', error);
            react_hot_toast_1.default.error('Failed to update schedule');
        }
    };
    const deleteSchedule = async (id) => {
        try {
            const response = await scraperApi_1.scraperApi.deleteSchedule(id);
            if (response.data.success) {
                react_hot_toast_1.default.success('Schedule deleted');
                fetchSchedules();
            }
            else {
                react_hot_toast_1.default.error('Failed to delete schedule');
            }
        }
        catch (error) {
            console.error('Error deleting schedule:', error);
            react_hot_toast_1.default.error('Failed to delete schedule');
        }
    };
    const runScheduleNow = async (id, source) => {
        try {
            const response = await scraperApi_1.scraperApi.runScheduleNow(id);
            if (response.data.success) {
                react_hot_toast_1.default.success(`${capitalizeFirstLetter(source)} scraper started`);
                if (refreshJobsList) {
                    refreshJobsList();
                }
            }
            else {
                react_hot_toast_1.default.error('Failed to run scraper');
            }
        }
        catch (error) {
            console.error('Error running scraper:', error);
            react_hot_toast_1.default.error('Failed to run scraper');
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-white shadow-md rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center mb-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Scheduled Scraping Jobs" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setShowAddModal(true), className: "px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm", children: "Add Schedule" })] }), loading ? ((0, jsx_runtime_1.jsx)("div", { className: "flex justify-center py-10", children: (0, jsx_runtime_1.jsx)(Spinner_1.Spinner, { size: "lg" }) })) : schedules.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "text-center py-10 text-gray-500", children: "No scheduled jobs found" })) : ((0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-2", children: "Source" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-2", children: "Frequency" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-2", children: "Last Run" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-2", children: "Next Run" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-2", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-2", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-gray-200", children: schedules.map(schedule => ((0, jsx_runtime_1.jsxs)("tr", { className: "hover:bg-gray-50", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-2", children: capitalizeFirstLetter(schedule.source) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-2", children: capitalizeFirstLetter(schedule.frequency) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-2 text-sm text-gray-600", children: schedule.lastRun
                                            ? new Date(schedule.lastRun).toLocaleString()
                                            : 'Never' }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-2 text-sm text-gray-600", children: schedule.nextRun && schedule.active
                                            ? new Date(schedule.nextRun).toLocaleString()
                                            : '-' }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-2", children: (0, jsx_runtime_1.jsx)("span", { className: `px-2 py-1 rounded-full text-xs ${schedule.active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'}`, children: schedule.active ? 'Active' : 'Inactive' }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-2", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => runScheduleNow(schedule.id, schedule.source), className: "px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs", children: "Run Now" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => toggleScheduleActive(schedule.id, schedule.active), className: `px-2 py-1 rounded text-xs ${schedule.active
                                                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                                        : 'bg-green-100 text-green-700 hover:bg-green-200'}`, children: schedule.active ? 'Deactivate' : 'Activate' }), (0, jsx_runtime_1.jsx)("button", { onClick: () => deleteSchedule(schedule.id), className: "px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs", children: "Delete" })] }) })] }, schedule.id))) })] }) })), showAddModal && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg max-w-lg w-full", children: [(0, jsx_runtime_1.jsx)("div", { className: "p-4 border-b", children: (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Add Scheduled Scraper" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Data Source" }), (0, jsx_runtime_1.jsx)("select", { className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: newSchedule.source, onChange: (e) => handleSourceChange(e.target.value), children: sources.map(source => ((0, jsx_runtime_1.jsx)("option", { value: source, children: capitalizeFirstLetter(source) }, source))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Frequency" }), (0, jsx_runtime_1.jsx)("select", { className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: newSchedule.frequency, onChange: (e) => setNewSchedule({ ...newSchedule, frequency: e.target.value }), children: frequencies.map(freq => ((0, jsx_runtime_1.jsx)("option", { value: freq.value, children: freq.label }, freq.value))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Configuration (JSON)" }), (0, jsx_runtime_1.jsx)("textarea", { className: "w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm h-48", value: newSchedule.config, onChange: (e) => setNewSchedule({ ...newSchedule, config: e.target.value }) }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "Enter the scraper configuration in JSON format" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 border-t flex justify-end space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setShowAddModal(false), className: "px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { onClick: addSchedule, className: "px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600", children: "Add Schedule" })] })] }) }))] }));
};
exports.ScraperScheduler = ScraperScheduler;
// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
//# sourceMappingURL=ScraperScheduler.js.map