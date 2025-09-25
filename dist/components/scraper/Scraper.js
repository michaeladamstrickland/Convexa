import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ScraperConfigPanel } from './ScraperConfigPanel';
import { ScraperJobsList } from './ScraperJobsList';
import { ScraperScheduler } from './ScraperScheduler';
/**
 * Main Scraper component that integrates all scraper-related functionality
 */
export const Scraper = () => {
    const [activeTab, setActiveTab] = useState('jobs');
    const [refreshJobsListKey, setRefreshJobsListKey] = useState(0);
    const refreshJobsList = () => {
        setRefreshJobsListKey(prev => prev + 1);
    };
    return (_jsxs("div", { className: "px-4 py-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Property Data Scraper" }), _jsx("div", { className: "flex mb-6", children: _jsx("div", { className: "border-b border-gray-200", children: _jsxs("nav", { className: "-mb-px flex space-x-8", children: [_jsx("button", { onClick: () => setActiveTab('jobs'), className: `py-2 px-1 ${activeTab === 'jobs'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: "Jobs" }), _jsx("button", { onClick: () => setActiveTab('schedules'), className: `py-2 px-1 ${activeTab === 'schedules'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: "Schedules" })] }) }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsx("div", { className: "lg:col-span-1", children: _jsx(ScraperConfigPanel, { onJobStarted: refreshJobsList }) }), _jsx("div", { className: "lg:col-span-2", children: activeTab === 'jobs' ? (_jsx(ScraperJobsList, { limit: 10, showRefresh: true }, refreshJobsListKey)) : (_jsx(ScraperScheduler, { refreshJobsList: refreshJobsList })) })] })] }));
};
//# sourceMappingURL=Scraper.js.map