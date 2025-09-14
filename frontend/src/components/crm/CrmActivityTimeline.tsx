import { useState } from "react";
import { CrmActivity } from "../../hooks/useCrmActivity";

type Props = {
  activities: CrmActivity[];
  isLoading?: boolean;
  error?: unknown;
};

const typeLabels: Record<string, string> = {
  note: "Note",
  "enrichment.completed": "Enrichment Completed",
  "call.summary": "Call Summary",
  "call.live.transcript": "Live Transcript",
  "call.live.summary": "Live Call Summary",
};

export default function CrmActivityTimeline({ activities, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-white p-4 shadow-sm text-sm text-gray-500">
        Loading CRM activity…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border bg-white p-4 shadow-sm text-sm text-red-600">
        Failed to load CRM activity
      </div>
    );
  }
  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-4 shadow-sm text-sm text-gray-500">
        No activity yet
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {activities
          .slice()
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
          .map((a) => (
            <TimelineRow key={a.id} activity={a} />
          ))}
      </div>
    </div>
  );
}

function TimelineRow({ activity }: { activity: CrmActivity }) {
  const [open, setOpen] = useState(false);
  const label = typeLabels[activity.type] || activity.type;
  const ts = new Date(activity.createdAt).toLocaleString();

  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-gray-500">{ts}</div>
        </div>
        <button
          className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "View"}
        </button>
      </div>
      {open && (
        <div className="mt-3 text-sm">
          <ActivityDetails activity={activity} />
        </div>
      )}
    </div>
  );
}

function ActivityDetails({ activity }: { activity: CrmActivity }) {
  const d = activity.data || {};
  if (activity.type === "note") {
    return <pre className="whitespace-pre-wrap text-gray-800">{d.text || JSON.stringify(d, null, 2)}</pre>;
  }
  if (activity.type === "enrichment.completed") {
    return (
      <div className="space-y-1">
        <div>Provider: {d.provider || "-"}</div>
        <div>Phones: {d.phones?.length ?? 0}, Emails: {d.emails?.length ?? 0}</div>
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(d, null, 2)}</pre>
      </div>
    );
  }
  if (activity.type === "call.summary") {
    return (
      <div className="space-y-2">
        <div className="font-medium">{d.summary || d.text || "Call summary"}</div>
        <div className="text-xs text-gray-600">
          Score: {d.motivationScore ?? d.score ?? "-"} • Outcome: {d.outcome ?? "-"} • Sentiment: {d.sentiment ?? "-"}
        </div>
        {d.callSid && <div className="text-xs text-gray-600">Call SID: {d.callSid}</div>}
        <div className="flex flex-wrap gap-2">
          {d.tags?.map((t: string) => (
            <span key={t} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">{t}</span>
          ))}
        </div>
        {(d.transcriptUrl || d.recordingUrl) && (
          <div className="text-xs">
            {d.transcriptUrl && (
              <a className="text-indigo-600 underline" href={d.transcriptUrl} target="_blank">Transcript</a>
            )}
            {d.recordingUrl && (
              <a className="ml-3 text-indigo-600 underline" href={d.recordingUrl} target="_blank">Audio</a>
            )}
          </div>
        )}
      </div>
    );
  }
  // Default: raw JSON
  return (
    <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(d, null, 2)}</pre>
  );
}
