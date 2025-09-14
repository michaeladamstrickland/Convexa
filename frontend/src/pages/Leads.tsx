import { useLeads } from "../hooks/useLeads";
import { Link } from "react-router-dom";

export default function Leads() {
  const { data, isLoading, error } = useLeads({ page: 1, limit: 25 });
  const leads = data?.data.leads || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600">Latest leads from your data sources</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">All Leads</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">Loading…</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-red-600">Failed to load</td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No leads found</td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{lead.propertyAddress || `${lead.city}, ${lead.state} ${lead.zipCode}`}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.ownerName || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link className="text-indigo-600 hover:text-indigo-900" to={`/leads/${lead.id}`}>View Details</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
