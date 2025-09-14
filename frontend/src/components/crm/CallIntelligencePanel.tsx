import { useMemo } from "react";
import { useCrmActivity, CrmActivity } from "../../hooks/useCrmActivity";
import api from "../../api/client";
import { useQuery } from "@tanstack/react-query";

export default function CallIntelligencePanel({ leadId }: { leadId: string }) {
  const { data, isLoading, error } = useCrmActivity(leadId);

  const calls = useMemo(() => (data || []).filter(a => a.type === "call.summary"), [data]);

  const metrics = useQuery({
    queryKey: ["metrics", "dev"],
    queryFn: async () => {
      const res = await api.get("/dev/metrics");
      return typeof res.data === "string" ? res.data as string : JSON.stringify(res.data);
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <Card>Loading call intelligence…</Card>;
  if (error) return <Card error>Failed to load call intelligence</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 text-sm text-gray-600">{calls.length} analyzed calls</div>
        <div className="space-y-3">
          {calls.length === 0 && <div className="text-sm text-gray-500">No call summaries yet</div>}
          {calls.map((c) => (
            <CallSummaryRow key={c.id} activity={c} />
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-2 text-sm font-semibold">Backend Metrics (dev)</div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded">
{metrics.data || ""}
        </pre>
      </Card>
    </div>
  );
}

function CallSummaryRow({ activity }: { activity: CrmActivity }) {
  const d = activity.data || {};
  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{d.summary || d.text || "Summary unavailable"}</div>
        <div className="text-xs text-gray-600">{new Date(activity.createdAt).toLocaleString()}</div>
      </div>
      <div className="mt-1 text-xs text-gray-600">
        Score: {d.motivationScore ?? d.score ?? "-"} • Outcome: {d.outcome ?? "-"} • Sentiment: {d.sentiment ?? "-"}
      </div>
      {(d.transcriptUrl || d.recordingUrl) && (
        <div className="mt-1 text-xs">
          {d.transcriptUrl && <a className="text-indigo-600 underline" href={d.transcriptUrl} target="_blank">Transcript</a>}
          {d.recordingUrl && <a className="ml-3 text-indigo-600 underline" href={d.recordingUrl} target="_blank">Audio</a>}
        </div>
      )}
      {Array.isArray(d.tags) && d.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {d.tags.map((t: string) => (
            <span key={t} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">{t}</span>
          ))}
        </div>
      )}
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
