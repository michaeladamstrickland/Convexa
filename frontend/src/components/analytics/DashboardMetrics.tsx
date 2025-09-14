import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";

export default function DashboardMetrics() {
  const dashboard = useQuery({
    queryKey: ["dashboardMetrics"],
    queryFn: async () => (await api.get("/admin/dashboard-metrics")).data,
    refetchInterval: 30000,
  });
  const dev = useQuery({
    queryKey: ["devMetrics"],
    queryFn: async () => (await api.get("/dev/metrics")).data,
    refetchInterval: 30000,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold">Dashboard Metrics</div>
        {dashboard.isLoading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : dashboard.error ? (
          <div className="text-sm text-red-600">Failed to load</div>
        ) : (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded">{JSON.stringify(dashboard.data, null, 2)}</pre>
        )}
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold">Prometheus (raw)</div>
        {dev.isLoading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : dev.error ? (
          <div className="text-sm text-red-600">Failed to load</div>
        ) : (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded">{typeof dev.data === 'string' ? dev.data : JSON.stringify(dev.data)}</pre>
        )}
      </div>
    </div>
  );
}
