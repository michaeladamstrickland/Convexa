import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LeadContactsPanel, SkipTraceButton } from "../../components";
import { useCrmActivity } from "../../hooks/useCrmActivity";
import CrmActivityTimeline from "../../components/crm/CrmActivityTimeline";
import CallIntelligencePanel from "../../components/crm/CallIntelligencePanel";
import { leadsApi } from "../../api/leads";
import { CrmComposerModal } from "../../components";

type ApiLead = Awaited<ReturnType<typeof leadsApi.getLead>>["data"];

export function LeadDetailPage() {
  const { leadId = "" } = useParams<{ leadId: string }>();
  
  const { data: leadResp, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => leadsApi.getLead(leadId),
    enabled: !!leadId
  });
  const lead: ApiLead | undefined = leadResp?.data;

  const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'crm' | 'calls' | 'notes' | 'history'>('details');
  const crm = useCrmActivity(leadId);
  const [composerOpen, setComposerOpen] = useState(false);
  
  if (isLoading) return <div className="p-4">Loading lead details...</div>;
  if (!lead) return <div className="p-4">Lead not found</div>;
  
  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{lead.propertyAddress || `${lead.city}, ${lead.state} ${lead.zipCode}`}</h1>
          <p className="text-gray-600">Owner: {lead.ownerName || "Unknown"}</p>
        </div>
        <div>
          <SkipTraceButton leadId={lead.id} />
        </div>
      </div>
      
      {/* Tabs */}
      <div className="mb-4 border-b">
        <nav className="flex space-x-6" aria-label="Tabs">
          {['details', 'contacts', 'crm', 'calls', 'notes', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`
                border-b-2 px-1 py-3 text-sm font-medium
                ${activeTab === tab 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
              `}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-semibold">Property Details</h3>
              <div className="space-y-2">
                <p>Address: {lead.propertyAddress || `${lead.city}, ${lead.state} ${lead.zipCode}`}</p>
                <p>Owner: {lead.ownerName}</p>
                {/* Add other property details */}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'contacts' && <LeadContactsPanel leadId={lead.id} />}
        {activeTab === 'crm' && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <button
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                onClick={() => setComposerOpen(true)}
                data-testid="crm-add-activity"
              >
                + Add Activity
              </button>
              <a
                href={`/admin/webhooks?leadId=${lead.id}`}
                className="text-sm text-indigo-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                View Webhook Deliveries
              </a>
            </div>
            <CrmActivityTimeline activities={crm.data || []} isLoading={crm.isLoading} error={crm.error} />
            {composerOpen && (
              <CrmComposerModal
                leadId={lead.id}
                onClose={() => setComposerOpen(false)}
                onCreated={() => {
                  setComposerOpen(false);
                  crm.refetch();
                }}
              />
            )}
          </div>
        )}
        {activeTab === 'calls' && (
          <CallIntelligencePanel leadId={lead.id} />
        )}
        
        {activeTab === 'notes' && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold">Notes</h3>
            <p className="text-gray-500">No notes available</p>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold">Activity History</h3>
            <p className="text-gray-500">No activity recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}
