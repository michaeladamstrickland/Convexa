import { useQuery } from "@tanstack/react-query";
import { getSkipTraceMetrics } from "../../services/skipTraceAPI";

export function SkipTraceDashboardWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["skipTraceMetrics", "today"],
    queryFn: () => getSkipTraceMetrics("30d"),
    refetchInterval: 60_000, // refresh every minute
  });

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Skip Trace — Last 30 Days</h3>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading metrics…</div>}
      {error && <div className="text-sm text-red-600">Failed to load metrics</div>}

      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPI label="Traces" value={data.traces} />
          <KPI label="Hit rate" value={`${Math.round((data.hitRate ?? 0) * 100)}%`} />
          <KPI label="Cost" value={`$${(data.cost ?? 0).toFixed(2)}`} />
          <KPI label="CPCL" value={`$${(data.cpcl ?? 0).toFixed(2)}`} />
        </div>
      )}

      {data?.byProvider?.length ? (
        <div className="mt-4 rounded border bg-gray-50 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-600">By provider</div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {data.byProvider.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded bg-white px-3 py-2">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-600">
                  hit {Math.round((p.hitRate ?? 0) * 100)}% • avg ${Number(p.avgCost ?? 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-white p-3 text-center">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
