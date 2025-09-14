import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkSkipTrace } from "../../services/skipTraceAPI";
import { useState } from "react";

type Props = {
  leadIds: string[];
  onClose: () => void;
};

export function BulkSkipTraceModal({ leadIds, onClose }: Props) {
  const queryClient = useQueryClient();
  const [respectQuietHours, setRespectQuietHours] = useState(true);

  const m = useMutation({
    mutationFn: () => bulkSkipTrace(leadIds, { respectQuietHours }),
    onSuccess: () => {
      // Invalidate the lead contacts queries to refresh data for all affected leads
      leadIds.forEach(id => {
        queryClient.invalidateQueries({ queryKey: ["leadContacts", id] });
      });
      // Invalidate lead list if needed
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">Bulk Skip Trace</h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="text-sm text-gray-600">
            Selected: <b>{leadIds.length}</b> leads
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={respectQuietHours}
                onChange={(e) => setRespectQuietHours(e.target.checked)}
              />
              Respect quiet hours
            </label>
            <div className="text-sm text-gray-600">• DNC suppression enabled</div>
          </div>

          <button
            className="rounded bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50"
            onClick={() => m.mutate()}
            disabled={m.isPending}
          >
            {m.isPending ? "Processing…" : "Start Bulk Trace"}
          </button>

          {m.isSuccess && (
            <div className="space-y-2">
              <div className="rounded bg-emerald-50 p-3 text-emerald-800">
                <b>Summary:</b> attempted {m.data.summary.requested} • processed {m.data.summary.processed} • hits {m.data.summary.hits} • no hits {m.data.summary.noHits} • cost ${m.data.summary.cost.toFixed(2)}
              </div>
              <div className="max-h-64 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Lead</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Matches</th>
                      <th className="px-3 py-2 text-left">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.data.results.map((r) => (
                      <tr key={r.leadId} className="border-t">
                        <td className="px-3 py-2">{r.leadId}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-3 py-2">{r.matches}</td>
                        <td className="px-3 py-2">${r.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {m.isError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {(m.error as Error).message || "Bulk trace failed"}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button className="px-3 py-1.5 rounded-md" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    success: "bg-emerald-50 text-emerald-700",
    no_hit: "bg-slate-50 text-slate-700",
    suppressed: "bg-rose-50 text-rose-700",
    error: "bg-red-50 text-red-700",
    queued: "bg-slate-50 text-slate-700",
    running: "bg-indigo-50 text-indigo-700"
  };
  
  const labels = {
    success: "Success",
    no_hit: "No Hit",
    suppressed: "Suppressed",
    error: "Error",
    queued: "Queued",
    running: "Running"
  };
  
  const colorClass = colors[status as keyof typeof colors] || colors.error;
  const label = labels[status as keyof typeof labels] || status;
  
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs ${colorClass}`}>
      {label}
    </span>
  );
}
