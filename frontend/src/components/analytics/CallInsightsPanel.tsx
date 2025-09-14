import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";
import {
  parsePrometheusText,
  getCounterTotal,
  getHistogramBuckets,
  getHistogramCount,
  getHistogramSum,
} from "../../utils/prometheus";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export default function CallInsightsPanel() {
  const [outcome, setOutcome] = useState<string | "all">("all");
  const [tag, setTag] = useState<string | "all">("all");
  const q = useQuery({
    queryKey: ["metrics", "dev"],
    queryFn: async () => (await api.get("/dev/metrics")).data as string,
    refetchInterval: 30000,
  });

  if (q.isLoading) return <Card>Loading call insights…</Card>;
  if (q.error) return <Card error>Failed to load call metrics</Card>;

  const raw = typeof q.data === "string" ? q.data : JSON.stringify(q.data);
  const metrics = parsePrometheusText(raw);

  // Build filters
  const labelFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (outcome !== "all") f["outcome"] = outcome;
    if (tag !== "all") f["tag"] = tag;
    return f;
  }, [outcome, tag]);

  // Derive available filter options from metrics labels
  const { outcomes, tags } = useMemo(() => {
    const o = new Set<string>();
    const t = new Set<string>();
    const any = metrics["leadflow_call_summary_total"]; 
    if (any) {
      for (const s of any.samples) {
        if (s.labels.outcome) o.add(s.labels.outcome);
        if (s.labels.tag) t.add(s.labels.tag);
      }
    }
    const hist = metrics["leadflow_call_scoring_ms_bucket"]; 
    if (hist) {
      for (const s of hist.samples) {
        if (s.labels.outcome) o.add(s.labels.outcome);
        if (s.labels.tag) t.add(s.labels.tag);
      }
    }
    return { outcomes: Array.from(o), tags: Array.from(t) };
  }, [metrics]);

  const totalCalls =
    getCounterTotal(metrics, "leadflow_call_summary_total", labelFilters) ??
    getCounterTotal(metrics, "leadflow_call_live_summary_total", labelFilters) ?? 0;

  const liveCalls = getCounterTotal(metrics, "leadflow_call_live_summary_total", labelFilters) ?? 0;

  const buckets = getHistogramBuckets(metrics, "leadflow_call_scoring_ms", labelFilters);
  const count = getHistogramCount(metrics, "leadflow_call_scoring_ms", labelFilters);
  const sum = getHistogramSum(metrics, "leadflow_call_scoring_ms", labelFilters);

  const percentiles = computePercentilesFromBuckets(buckets, [0.5, 0.9, 0.99]);
  const avg = count > 0 ? Math.round((sum / count) * 100) / 100 : null;

  const barData = buckets.map((b) => ({ bucket: b.le, value: b.value }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <div className="mb-2 text-sm font-semibold">Call Summary</div>
        <div className="flex flex-wrap gap-2 mb-3">
          <Select label="Outcome" value={outcome} onChange={setOutcome} options={["all", ...outcomes]} />
          <Select label="Tag" value={tag} onChange={setTag} options={["all", ...tags]} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Total analyzed calls" value={totalCalls} />
          <Stat label="Live calls observed" value={liveCalls} />
          <Stat label="Avg scoring latency (ms)" value={avg ?? "-"} />
          <Stat label="P50 / P90 / P99 (ms)" value={percentiles.map(p=>p.value ?? "-").join(" / ")} />
        </div>
      </Card>
      <Card>
        <div className="mb-2 text-sm font-semibold">Call Scoring Latency (ms)</div>
        {barData.length === 0 ? (
          <div className="text-xs text-gray-500">No histogram data</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-20} height={40} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card>
        <div className="mb-2 text-sm font-semibold">Percentiles (ms)</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={percentiles.map(p=>({ name: p.label, value: p.value }))} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex gap-2">
          <ExportButton raw={raw} metrics={metrics} labelFilters={labelFilters} />
          <a
            className="text-xs text-indigo-600 hover:underline"
            href="/api/dev/metrics"
            target="_blank"
            rel="noreferrer"
          >
            Open in Prometheus
          </a>
        </div>
      </Card>
      <Card>
        <div className="mb-2 text-sm font-semibold">Raw Metrics (trimmed)</div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded">{raw.slice(0, 4000)}</pre>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded border p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value ?? "-"}</div>
    </div>
  );
}

function Card({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${error ? "border-red-200" : ""}`}>
      {children}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: any)=>void; options: string[] }) {
  return (
    <label className="text-xs text-gray-700 flex items-center gap-2">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="rounded border px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:text-gray-100"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function computePercentilesFromBuckets(
  buckets: Array<{ le: string; value: number }>,
  percentiles: number[]
) {
  const total = buckets[buckets.length - 1]?.value ?? 0;
  const results = percentiles.map((p) => {
    const target = total * p;
    let val: number | null = null;
    for (const b of buckets) {
      if (b.value >= target) {
        const n = b.le === "+Inf" ? null : Number(b.le);
        val = typeof n === "number" && !Number.isNaN(n) ? Math.round(n * 100) / 100 : null;
        break;
      }
    }
    return { label: `P${Math.round(p * 100)}`, value: val };
  });
  return results;
}

function ExportButton({ raw, metrics, labelFilters }: { raw: string; metrics: any; labelFilters: Record<string, string> }) {
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ labelFilters, metrics }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleExportCSV = () => {
    // Flatten histogram buckets to CSV
    const parsed = parsePrometheusText(raw);
    const rows: string[] = ["metric,le,outcome,tag,value"]; 
    const h = parsed["leadflow_call_scoring_ms_bucket"]; 
    if (h) {
      for (const s of h.samples) {
        if (labelFilters && !Object.entries(labelFilters).every(([k,v]) => k === "le" ? true : s.labels[k] === v)) continue;
        rows.push([
          "leadflow_call_scoring_ms_bucket",
          s.labels.le ?? "",
          s.labels.outcome ?? "",
          s.labels.tag ?? "",
          s.value.toString(),
        ].join(","));
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-metrics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex gap-2">
      <button className="text-xs px-2 py-1 rounded border hover:bg-gray-50" onClick={handleExportJSON}>Export JSON</button>
      <button className="text-xs px-2 py-1 rounded border hover:bg-gray-50" onClick={handleExportCSV}>Export CSV</button>
    </div>
  );
}
