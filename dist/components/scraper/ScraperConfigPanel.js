import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Spinner } from '../common/Spinner';
import { scraperApi } from '../../services/scraperApi';
/**
 * Component for configuring and starting scraper jobs
 */
export const ScraperConfigPanel = ({ onJobStarted }) => {
    const [selectedSource, setSelectedSource] = useState('zillow');
    const [isLoading, setIsLoading] = useState(false);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [config, setConfig] = useState({
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
            const response = await scraperApi.startScraper(selectedSource, config[selectedSource]);
            if (response.data && response.data.success) {
                toast.success(`${capitalizeFirstLetter(selectedSource)} scraper started successfully`);
                if (onJobStarted) {
                    onJobStarted();
                }
            }
            else {
                toast.error(`Failed to start ${selectedSource} scraper`);
            }
        }
        catch (error) {
            console.error('Error starting scraper:', error);
            toast.error(`Error starting ${selectedSource} scraper: ${error?.message || ''}`);
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
    const renderZillowForm = () => (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "col-span-1 md:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Location" }), _jsx("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.location, onChange: (e) => handleConfigChange('location', e.target.value), placeholder: "City, State or ZIP code" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Price" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.minPrice, onChange: (e) => handleConfigChange('minPrice', parseInt(e.target.value)), placeholder: "Min Price" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Price" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.maxPrice, onChange: (e) => handleConfigChange('maxPrice', parseInt(e.target.value)), placeholder: "Max Price" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Beds" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.minBeds, onChange: (e) => handleConfigChange('minBeds', parseInt(e.target.value)), placeholder: "Min Bedrooms" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Baths" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.minBaths, onChange: (e) => handleConfigChange('minBaths', parseInt(e.target.value)), placeholder: "Min Bathrooms" })] }), advancedMode && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Results" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.zillow.maxResults, onChange: (e) => handleConfigChange('maxResults', parseInt(e.target.value)), placeholder: "Max Results" })] }))] }));
    const renderAuctionForm = () => (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "State" }), _jsx("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.state, onChange: (e) => handleConfigChange('state', e.target.value), placeholder: "State" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "County" }), _jsx("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.county, onChange: (e) => handleConfigChange('county', e.target.value), placeholder: "County" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Days Ahead" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.daysAhead, onChange: (e) => handleConfigChange('daysAhead', parseInt(e.target.value)), placeholder: "Days Ahead" })] }), advancedMode && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Results" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.auction.maxResults, onChange: (e) => handleConfigChange('maxResults', parseInt(e.target.value)), placeholder: "Max Results" })] }))] }));
    const renderCountyForm = () => (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "State" }), _jsx("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.state, onChange: (e) => handleConfigChange('state', e.target.value), placeholder: "State" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "County" }), _jsx("input", { type: "text", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.county, onChange: (e) => handleConfigChange('county', e.target.value), placeholder: "County" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Days Back" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.daysBack, onChange: (e) => handleConfigChange('daysBack', parseInt(e.target.value)), placeholder: "Days Back" })] }), advancedMode && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Record Types" }), _jsxs("select", { multiple: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.recordTypes, onChange: (e) => {
                                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                                    handleConfigChange('recordTypes', selected);
                                }, children: [_jsx("option", { value: "deed", children: "Deeds" }), _jsx("option", { value: "foreclosure", children: "Foreclosures" }), _jsx("option", { value: "tax_lien", children: "Tax Liens" }), _jsx("option", { value: "mortgage", children: "Mortgages" }), _jsx("option", { value: "notice_default", children: "Notices of Default" })] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Hold Ctrl/Cmd to select multiple" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Results" }), _jsx("input", { type: "number", className: "w-full px-3 py-2 border border-gray-300 rounded-md", value: config.county.maxResults, onChange: (e) => handleConfigChange('maxResults', parseInt(e.target.value)), placeholder: "Max Results" })] })] }))] }));
    return (_jsxs("div", { className: "bg-white shadow-md rounded-lg p-4", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Start New Scraper" }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Data Source" }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { className: `px-4 py-2 rounded-md ${selectedSource === 'zillow' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`, onClick: () => setSelectedSource('zillow'), children: "Zillow" }), _jsx("button", { className: `px-4 py-2 rounded-md ${selectedSource === 'auction' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`, onClick: () => setSelectedSource('auction'), children: "Auctions" }), _jsx("button", { className: `px-4 py-2 rounded-md ${selectedSource === 'county' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`, onClick: () => setSelectedSource('county'), children: "County Records" })] })] }), _jsxs("div", { className: "mb-6", children: [selectedSource === 'zillow' && renderZillowForm(), selectedSource === 'auction' && renderAuctionForm(), selectedSource === 'county' && renderCountyForm()] }), _jsx("div", { className: "flex items-center justify-between mb-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "advancedMode", checked: advancedMode, onChange: () => setAdvancedMode(!advancedMode), className: "h-4 w-4 text-blue-600 border-gray-300 rounded" }), _jsx("label", { htmlFor: "advancedMode", className: "ml-2 text-sm text-gray-700", children: "Advanced Options" })] }) }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: startScraper, disabled: isLoading, className: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed", children: isLoading ? _jsx(Spinner, { size: "sm" }) : `Start ${capitalizeFirstLetter(selectedSource)} Scraper` }) })] }));
};
// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
//# sourceMappingURL=ScraperConfigPanel.js.map