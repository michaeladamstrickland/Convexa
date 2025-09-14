import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeads } from "../../hooks/useLeads";
import { useLeadSelection } from "../../hooks/useLeadSelection";
import { useTraceFilters } from "../../hooks/useTraceFilters";
import { 
  SkipTraceButton, 
  BulkSkipTraceButton, 
  TraceStatusChip, 
  BestPhoneCell 
} from "../../components";

export function LeadsTable() {
  const { data, isLoading, error } = useLeads({ page: 1, limit: 50 });
  const leads = data?.data.leads || [];
  
  const { selectedLeadIds, toggleLeadSelection, selectAllLeads, clearLeadSelection, hasSelection } = useLeadSelection();
  const { filter, setFilter, filteredLeads, filters } = useTraceFilters(leads);
  
  // Select all checkbox
  const [selectAll, setSelectAll] = useState(false);
  
  const handleSelectAll = () => {
    if (selectAll) {
      clearLeadSelection();
    } else {
      selectAllLeads(filteredLeads);
    }
    setSelectAll(!selectAll);
  };
  
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BulkSkipTraceButton selectedLeadIds={selectedLeadIds} disabled={!hasSelection} />
          
          <select 
            className="rounded border px-2 py-1.5 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            {filters.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        
        <div className="text-sm text-gray-500">
          {hasSelection ? `${selectedLeadIds.length} selected` : `${filteredLeads.length} leads`}
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-10 px-3 py-3">
                <input 
                  type="checkbox" 
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Address
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Owner
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Trace Status
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Best Phone
              </th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                  Loading leads...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-sm text-red-600">
                  Failed to load leads
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                  No leads match the current filter
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <input 
                      type="checkbox" 
                      checked={selectedLeadIds.includes(lead.id)} 
                      onChange={() => toggleLeadSelection(lead.id)}
                    />
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900">
                    <Link className="text-indigo-600 hover:underline" to={`/leads/${lead.id}`}>
                      {lead.propertyAddress || `${(lead as any).city ?? ''}${(lead as any).state ? ', ' + (lead as any).state : ''} ${(lead as any).zipCode ?? ''}`}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900">
                    {lead.ownerName}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {lead.traceStatus && <TraceStatusChip status={lead.traceStatus} />}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <BestPhoneCell 
                      phoneNumber={lead.bestPhone} 
                      confidence={lead.phoneConfidence}
                    />
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium">
                    <SkipTraceButton 
                      leadId={lead.id} 
                      disabled={lead.traceStatus === "Completed"}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
