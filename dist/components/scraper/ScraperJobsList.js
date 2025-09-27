import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useScraperWebSocket } from '../../hooks/useScraperWebSocket';
import { Spinner } from '../common/Spinner';
import toast from 'react-hot-toast';
import { scraperApi } from '../../services/scraperApi';
/**
 * Component for displaying a list of scraping jobs with real-time updates
 */
export const ScraperJobsList = ({ limit = 10, showRefresh = true }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
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
            }
            else {
                console.error('Invalid response format:', response.data);
                toast.error('Failed to load scraping jobs');
            }
        }
        catch (error) {
            console.error('Error fetching jobs:', error);
            toast.error('Failed to load scraping jobs');
        }
        finally {
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
                    .then((response) => {
                    if (response.data.success) {
                        // Update the job in our list
                        setJobs(prevJobs => {
                            const updatedJobs = [...prevJobs];
                            const index = updatedJobs.findIndex(job => job.id === latestUpdate.job.id);
                            if (index !== -1) {
                                // Update existing job
                                updatedJobs[index] = response.data.data;
                            }
                            else {
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
                        }
                        else if (latestUpdate.action === 'job_failed') {
                            toast.error(`${capitalizeFirstLetter(latestUpdate.job.source)} scraping job failed`);
                        }
                    }
                })
                    .catch((error) => {
                    console.error('Error fetching updated job:', error);
                });
            }
        }
    }, [jobUpdates, limit]);
    const handleRefresh = () => {
        fetchJobs();
        toast.success('Jobs refreshed');
    };
    const viewJobDetails = (job) => {
        setSelectedJob(job);
        setShowModal(true);
    };
    const closeModal = () => {
        setShowModal(false);
        setSelectedJob(null);
    };
    const processRecords = async (jobId) => {
        try {
            toast.loading('Processing records...');
            const response = await scraperApi.processRecords(jobId);
            if (response.data.success) {
                toast.dismiss();
                toast.success(`Processed ${response.data.data.processedCount} records`);
            }
            else {
                toast.dismiss();
                toast.error('Failed to process records');
            }
        }
        catch (error) {
            toast.dismiss();
            console.error('Error processing records:', error);
            toast.error('Failed to process records');
        }
    };
    return (_jsxs("div", { className: "bg-white shadow-md rounded-lg p-4", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Recent Scraping Jobs" }), _jsxs("div", { className: "flex items-center", children: [isConnected && (_jsxs("span", { className: "inline-flex items-center mr-3 text-xs text-green-600", children: [_jsx("span", { className: "w-2 h-2 bg-green-500 rounded-full mr-1" }), "Live"] })), showRefresh && (_jsx("button", { onClick: handleRefresh, className: "px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm", disabled: loading, children: loading ? _jsx(Spinner, { size: "sm" }) : 'Refresh' }))] })] }), loading && jobs.length === 0 ? (_jsx("div", { className: "flex justify-center py-10", children: _jsx(Spinner, { size: "lg" }) })) : jobs.length === 0 ? (_jsx("div", { className: "text-center py-10 text-gray-500", children: "No scraping jobs found" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-2", children: "Source" }), _jsx("th", { className: "px-4 py-2", children: "Status" }), _jsx("th", { className: "px-4 py-2", children: "Results" }), _jsx("th", { className: "px-4 py-2", children: "Started" }), _jsx("th", { className: "px-4 py-2", children: "Duration" }), _jsx("th", { className: "px-4 py-2", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: jobs.map(job => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-4 py-2", children: capitalizeFirstLetter(job.source) }), _jsx("td", { className: "px-4 py-2", children: _jsx(StatusBadge, { status: job.status }) }), _jsx("td", { className: "px-4 py-2", children: job.resultsCount !== undefined ? job.resultsCount : '-' }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-600", children: formatTime(job.startedAt) }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-600", children: job.completedAt
                                            ? calculateDuration(job.startedAt, job.completedAt)
                                            : job.status === 'pending' || job.status === 'running'
                                                ? 'Running...'
                                                : '-' }), _jsx("td", { className: "px-4 py-2", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => viewJobDetails(job), className: "px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs", children: "Details" }), job.status === 'completed' && (_jsx("button", { onClick: () => processRecords(job.id), className: "px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs", children: "Process" }))] }) })] }, job.id))) })] }) })), showModal && selectedJob && (_jsx(JobDetailsModal, { job: selectedJob, onClose: closeModal, onProcess: () => processRecords(selectedJob.id) }))] }));
};
const StatusBadge = ({ status }) => {
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
    return (_jsx("span", { className: `px-2 py-1 rounded-full text-xs ${bgColor} ${textColor}`, children: capitalizeFirstLetter(status) }));
};
const JobDetailsModal = ({ job, onClose, onProcess }) => {
    const configObj = JSON.parse(job.config || '{}');
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto", children: [_jsx("div", { className: "p-4 border-b", children: _jsx("h2", { className: "text-lg font-semibold", children: "Scraping Job Details" }) }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-500 text-sm", children: "ID" }), _jsx("p", { className: "font-mono text-xs", children: job.id })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Source" }), _jsx("p", { children: capitalizeFirstLetter(job.source) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Status" }), _jsx("p", { children: _jsx(StatusBadge, { status: job.status }) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Results" }), _jsx("p", { children: job.resultsCount !== undefined ? job.resultsCount : '-' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Started At" }), _jsx("p", { children: new Date(job.startedAt).toLocaleString() })] }), job.completedAt && (_jsxs("div", { children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Completed At" }), _jsx("p", { children: new Date(job.completedAt).toLocaleString() })] }))] }), _jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-gray-500 text-sm mb-1", children: "Configuration" }), _jsx("div", { className: "bg-gray-50 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto", children: _jsx("pre", { children: JSON.stringify(configObj, null, 2) }) })] }), job.logs && (_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-gray-500 text-sm mb-1", children: "Logs" }), _jsx("div", { className: "bg-gray-50 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto", children: job.logs })] }))] }), _jsxs("div", { className: "p-4 border-t flex justify-end space-x-2", children: [job.status === 'completed' && (_jsx("button", { onClick: onProcess, className: "px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600", children: "Process Records" })), _jsx("button", { onClick: onClose, className: "px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300", children: "Close" })] })] }) }));
};
// Helper functions
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function formatTime(dateString) {
    try {
        const date = new Date(dateString);
        return formatDistanceToNow(date, { addSuffix: true });
    }
    catch {
        return dateString;
    }
}
function calculateDuration(start, end) {
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const durationMs = endDate.getTime() - startDate.getTime();
        if (durationMs < 1000) {
            return `${durationMs}ms`;
        }
        else if (durationMs < 60000) {
            return `${Math.round(durationMs / 1000)}s`;
        }
        else if (durationMs < 3600000) {
            return `${Math.round(durationMs / 60000)}m`;
        }
        else {
            return `${Math.round(durationMs / 3600000)}h ${Math.round((durationMs % 3600000) / 60000)}m`;
        }
    }
    catch {
        return '-';
    }
}
//# sourceMappingURL=ScraperJobsList.js.map