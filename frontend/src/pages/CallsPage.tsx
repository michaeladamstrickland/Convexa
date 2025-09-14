import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

export default function CallsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["calls", "summaries"],
    queryFn: async () => {
      const res = await api.get("/admin/crm-activity", { params: { type: "call.summary" } });
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Call Intelligence</h1>
      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">Failed to load</div>}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        {(data || []).map((a: any) => (
          <div key={a.id} className="border-b py-3 last:border-0">
            <div className="text-sm font-semibold">{a.data?.summary || a.data?.text || 'Summary unavailable'}</div>
            <div className="text-xs text-gray-600">Lead: {a.leadId || '-'} • {new Date(a.createdAt).toLocaleString()}</div>
          </div>
        ))}
        {(data || []).length === 0 && <div className="text-sm text-gray-500">No call summaries</div>}
      </div>
    </div>
  );
}
