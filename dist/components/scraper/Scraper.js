"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scraper = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ScraperConfigPanel_1 = require("./ScraperConfigPanel");
const ScraperJobsList_1 = require("./ScraperJobsList");
const ScraperScheduler_1 = require("./ScraperScheduler");
/**
 * Main Scraper component that integrates all scraper-related functionality
 */
const Scraper = () => {
    const [activeTab, setActiveTab] = (0, react_1.useState)('jobs');
    const [refreshJobsListKey, setRefreshJobsListKey] = (0, react_1.useState)(0);
    const refreshJobsList = () => {
        setRefreshJobsListKey(prev => prev + 1);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "px-4 py-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold mb-6", children: "Property Data Scraper" }), (0, jsx_runtime_1.jsx)("div", { className: "flex mb-6", children: (0, jsx_runtime_1.jsx)("div", { className: "border-b border-gray-200", children: (0, jsx_runtime_1.jsxs)("nav", { className: "-mb-px flex space-x-8", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setActiveTab('jobs'), className: `py-2 px-1 ${activeTab === 'jobs'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: "Jobs" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setActiveTab('schedules'), className: `py-2 px-1 ${activeTab === 'schedules'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: "Schedules" })] }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "lg:col-span-1", children: (0, jsx_runtime_1.jsx)(ScraperConfigPanel_1.ScraperConfigPanel, { onJobStarted: refreshJobsList }) }), (0, jsx_runtime_1.jsx)("div", { className: "lg:col-span-2", children: activeTab === 'jobs' ? ((0, jsx_runtime_1.jsx)(ScraperJobsList_1.ScraperJobsList, { limit: 10, showRefresh: true }, refreshJobsListKey)) : ((0, jsx_runtime_1.jsx)(ScraperScheduler_1.ScraperScheduler, { refreshJobsList: refreshJobsList })) })] })] }));
};
exports.Scraper = Scraper;
//# sourceMappingURL=Scraper.js.map