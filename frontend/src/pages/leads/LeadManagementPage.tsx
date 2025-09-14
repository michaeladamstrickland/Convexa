import { useState } from "react";
import { 
  SkipTraceButton, 
  BulkSkipTraceModal
} from "../../components";
import { Lead as SkipTraceLead } from "../../types/skiptrace";

// Example lead data structure
interface Lead {
  id: string;
  name: string;
  address: string;
  status: string;
  lastContact?: string;
}

export function LeadManagementPage() {
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  
  // Mock data for demonstration
  const leads: Lead[] = [
    { id: "1", name: "John Smith", address: "123 Main St", status: "New" },
    { id: "2", name: "Jane Doe", address: "456 Oak Ave", status: "Contacted" },
    { id: "3", name: "Robert Johnson", address: "789 Pine Rd", status: "New" },
    { id: "4", name: "Maria Garcia", address: "321 Elm Blvd", status: "Qualified" },
    { id: "5", name: "James Wilson", address: "654 Cedar Ln", status: "New" },
  ];
  
  // Handle lead selection for bulk operations
  const toggleLeadSelection = (lead: Lead) => {
    if (selectedLeads.find(l => l.id === lead.id)) {
      setSelectedLeads(selectedLeads.filter(l => l.id !== lead.id));
    } else {
      setSelectedLeads([...selectedLeads, lead]);
    }
  };
  
  // Open bulk modal when bulk skip trace is clicked
  const handleBulkSkipTrace = () => {
    if (selectedLeads.length > 0) {
      setIsBulkModalOpen(true);
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lead Management</h1>
        
        {/* Bulk actions */}
        <div className="flex gap-2">
          <button 
            disabled={selectedLeads.length === 0}
            onClick={handleBulkSkipTrace}
            className={`rounded px-4 py-2 ${selectedLeads.length > 0 
              ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            Skip Trace Selected ({selectedLeads.length})
          </button>
          
          <button 
            disabled={selectedLeads.length === 0}
            className={`rounded px-4 py-2 ${selectedLeads.length > 0 
              ? 'bg-gray-100 hover:bg-gray-200' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            Export Selected
          </button>
        </div>
      </div>
      
      {/* Leads table */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <input 
                  type="checkbox" 
                  onChange={() => {
                    if (selectedLeads.length === leads.length) {
                      setSelectedLeads([]);
                    } else {
                      setSelectedLeads([...leads]);
                    }
                  }}
                  checked={selectedLeads.length === leads.length && leads.length > 0}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <input 
                    type="checkbox"
                    checked={!!selectedLeads.find(l => l.id === lead.id)}
                    onChange={() => toggleLeadSelection(lead)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-4">{lead.name}</td>
                <td className="whitespace-nowrap px-6 py-4">{lead.address}</td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                    lead.status === "New" ? "bg-blue-100 text-blue-800" : 
                    lead.status === "Contacted" ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {lead.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex gap-2">
                    {/* Individual Skip Trace Button */}
                    <SkipTraceButton 
                      leadData={{
                        id: lead.id,
                        firstName: lead.name.split(' ')[0],
                        lastName: lead.name.split(' ')[1] || '',
                        address: {
                          street: lead.address,
                          city: "Example City",
                          state: "CA",
                          zip: "12345"
                        }
                      }}
                      onComplete={() => {
                        // Handle completion
                        console.log(`Skip trace completed for ${lead.name}`);
                      }}
                      buttonClassName="text-sm px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded"
                    />
                    
                    <button className="rounded bg-gray-50 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Bulk Skip Trace Modal */}
      {isBulkModalOpen && (
        <BulkSkipTraceModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          leadsData={selectedLeads.map(lead => ({
            id: lead.id,
            firstName: lead.name.split(' ')[0],
            lastName: lead.name.split(' ')[1] || '',
            address: {
              street: lead.address,
              city: "Example City",
              state: "CA",
              zip: "12345"
            }
          }))}
          onComplete={(results: any) => {
            console.log("Bulk skip trace completed", results);
            setIsBulkModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
