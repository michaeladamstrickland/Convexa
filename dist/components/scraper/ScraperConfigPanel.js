"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperConfigPanel = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_hot_toast_1 = __importDefault(require("react-hot-toast"));
const Spinner_1 = require("../common/Spinner");
const scraperApi_1 = require("../../services/scraperApi");
/**
 * Component for configuring and starting scraper jobs
 */
const ScraperConfigPanel = ({ onJobStarted }) => {
    const [selectedSource, setSelectedSource] = (0, react_1.useState)('zillow');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [advancedMode, setAdvancedMode] = (0, react_1.useState)(false);
    const [config, setConfig] = (0, react_1.useState)({
        zillow: {
            location: 'San Diego, CA',
            propertyTypes: ['house', 'condo'],
            minPrice: 300000,
            maxPrice: 1000000,
            minBeds: 2,
            minBaths: 2,
            maxResults: 50
        },
        auction: {
            state: 'California',
            county: 'San Diego',
            daysAhead: 30,
            maxResults: 50
        },
        county: {
            state: 'California',
            county: 'San Diego',
            recordTypes: ['deed', 'foreclosure', 'tax_lien'],
            daysBack: 30,
            maxResults: 100
        }
    });
    const startScraper = async () => {
        try {
            setIsLoading(true);
            const response = await scraperApi_1.scraperApi.startScraper(selectedSource, config[selectedSource]);
            if (response.data && response.data.success) {
                react_hot_toast_1.default.success(`${capitalizeFirstLetter(selectedSource)} scraper started successfully`);
                if (onJobStarted) {
                    onJobStarted();
                }
            }
            else {
                react_hot_toast_1.default.error(`Failed to start ${selectedSource} scraper`);
            }
        }
        catch (error) {
            console.error('Error starting scraper:', error);
            react_hot_toast_1.default.error(`Error starting ${selectedSource} scraper: ${error?.message || ''}`);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleConfigChange = (key, value) => {
        setConfig(prev => ({
            ...prev,
            [selectedSource]: {
                ...prev[selectedSource],
                [key]: value
            }
        }));
    };
    const renderZillowForm = () => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "col-span-1 md:col-span-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Location" }), (0, jsx_runtime_1.jsx)("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.location, onChange: (e) => handleConfigChange('location', e.target.value), placeholder: "City, State or ZIP code" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Price" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.minPrice, onChange: (e) => handleConfigChange('minPrice', parseInt(e.target.value)), placeholder: "Min Price" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Price" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.maxPrice, onChange: (e) => handleConfigChange('maxPrice', parseInt(e.target.value)), placeholder: "Max Price" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Beds" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.minBeds, onChange: (e) => handleConfigChange('minBeds', parseInt(e.target.value)), placeholder: "Min Bedrooms" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Baths" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.minBaths, onChange: (e) => handleConfigChange('minBaths', parseInt(e.target.value)), placeholder: "Min Bathrooms" })] }), advancedMode && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Results" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.maxResults, onChange: (e) => handleConfigChange('maxResults', parseInt(e.target.value)), placeholder: "Max Results" })] }))] }));
    const renderAuctionForm = () => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "State" }), (0, jsx_runtime_1.jsx)("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.state, onChange: (e) => handleConfigChange('state', e.target.value), placeholder: "State" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "County" }), (0, jsx_runtime_1.jsx)("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.county, onChange: (e) => handleConfigChange('county', e.target.value), placeholder: "County" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Days Ahead" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.daysAhead, onChange: (e) => handleConfigChange('daysAhead', parseInt(e.target.value)), placeholder: "Days Ahead" })] }), advancedMode && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Results" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.maxResults, onChange: (e) => handleConfigChange('maxResults', parseInt(e.target.value)), placeholder: "Max Results" })] }))] }));
    const renderCountyForm = () => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "State" }), (0, jsx_runtime_1.jsx)("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.state, onChange: (e) => handleConfigChange('state', e.target.value), placeholder: "State" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "County" }), (0, jsx_runtime_1.jsx)("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.county, onChange: (e) => handleConfigChange('county', e.target.value), placeholder: "County" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Days Back" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.daysBack, onChange: (e) => handleConfigChange('daysBack', parseInt(e.target.value)), placeholder: "Days Back" })] }), advancedMode && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Record Types" }), (0, jsx_runtime_1.jsxs)("select", { multiple: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.recordTypes, onChange: (e) => {
                                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                                    handleConfigChange('recordTypes', selected);
                                }, children: [(0, jsx_runtime_1.jsx)("option", { value: "deed", children: "Deeds" }), (0, jsx_runtime_1.jsx)("option", { value: "foreclosure", children: "Foreclosures" }), (0, jsx_runtime_1.jsx)("option", { value: "tax_lien", children: "Tax Liens" }), (0, jsx_runtime_1.jsx)("option", { value: "mortgage", children: "Mortgages" }), (0, jsx_runtime_1.jsx)("option", { value: "notice_default", children: "Notices of Default" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "Hold Ctrl/Cmd to select multiple" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Results" }), (0, jsx_runtime_1.jsx)("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.maxResults, onChange: (e) => handleConfigChange('maxResults', parseInt(e.target.value)), placeholder: "Max Results" })] })] }))] }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-white shadow-md rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold mb-4", children: "Start New Scraper" }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Data Source" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { className: `px-4 py-2 rounded-md ${selectedSource === 'zillow' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`, onClick: () => setSelectedSource('zillow'), children: "Zillow" }), (0, jsx_runtime_1.jsx)("button", { className: `px-4 py-2 rounded-md ${selectedSource === 'auction' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`, onClick: () => setSelectedSource('auction'), children: "Auctions" }), (0, jsx_runtime_1.jsx)("button", { className: `px-4 py-2 rounded-md ${selectedSource === 'county' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`, onClick: () => setSelectedSource('county'), children: "County Records" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-6", children: [selectedSource === 'zillow' && renderZillowForm(), selectedSource === 'auction' && renderAuctionForm(), selectedSource === 'county' && renderCountyForm()] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between mb-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", id: "advancedMode", checked: advancedMode, onChange: () => setAdvancedMode(!advancedMode), className: "h-4 w-4 text-blue-600 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("label", { htmlFor: "advancedMode", className: "ml-2 text-sm text-gray-700", children: "Advanced Options" })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", children: (0, jsx_runtime_1.jsx)("button", { onClick: startScraper, disabled: isLoading, className: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed", children: isLoading ? (0, jsx_runtime_1.jsx)(Spinner_1.Spinner, { size: "sm" }) : `Start ${capitalizeFirstLetter(selectedSource)} Scraper` }) })] }));
};
exports.ScraperConfigPanel = ScraperConfigPanel;
// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
//# sourceMappingURL=ScraperConfigPanel.js.map