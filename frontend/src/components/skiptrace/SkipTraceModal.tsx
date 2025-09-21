import { useState } from "react";
import { useSkipTrace } from "../../hooks/useSkipTrace";
import { PhoneIcon, MailIcon } from "lucide-react";

type Props = { leadId: string; onClose: () => void };

export function SkipTraceModal({ leadId, onClose }: Props) {
  const [respectQuietHours, setRespectQuietHours] = useState(true);
  const m = useSkipTrace(leadId);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">Skip Trace</h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={respectQuietHours}
                onChange={(e) => setRespectQuietHours(e.target.checked)}
              />
              Respect quiet hours (by lead timezone)
            </label>
            <button
              onClick={() => m.mutate({ respectQuietHours })}
              disabled={m.isPending}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white disabled:opacity-50"
            >
              {m.isPending ? "Tracing…" : "Run Trace"}
            </button>
          </div>

          {m.isPending && (
            <div className="rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
              Contacting providers… Batch → Whitepages → Public
            </div>
          )}

          {m.isError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {(m.error as Error).message || "Trace failed"}
            </div>
          )}

          {m.isSuccess && m.data && (
            <div className="space-y-4">
              <SummaryBar
                providers={m.data.providersTried}
                cost={m.data.cost}
                compliance={m.data.compliance}
              />
              <ResultsList
                phones={m.data.contacts?.phones ?? []}
                emails={m.data.contacts?.emails ?? []}
              />
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

function SummaryBar({
  providers,
  cost,
  compliance,
}: {
  providers: string[];
  cost: number;
  compliance: { quietHours: boolean; dncSuppressed?: number };
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="rounded bg-gray-100 px-2 py-1">
        Providers: {providers.join(" → ")}
      </span>
      <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-1">
        Cost: ${cost.toFixed(2)}
      </span>
      {compliance.quietHours && (
        <span className="rounded bg-amber-50 text-amber-800 px-2 py-1">
          Quiet hours enforced
        </span>
      )}
      {!!compliance.dncSuppressed && (
        <span className="rounded bg-rose-50 text-rose-700 px-2 py-1">
          DNC suppressed: {compliance.dncSuppressed}
        </span>
      )}
    </div>
  );
}

function ResultsList({
  phones,
  emails,
}: {
  phones: Array<any>;
  emails: Array<any>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-semibold">Phones</h4>
        <div className="space-y-2">
          {phones.length === 0 && <EmptyRow label="No phone hits" />}
          {phones.map((p, idx) => (
            <ContactRow
              key={idx}
              icon={<PhoneIcon size={16} />}
              value={p.value}
              meta={`${p.type ?? "phone"} • ${(p.confidence * 100).toFixed(0)}%`}
              badges={[
                p.dnc ? "DNC" : null,
                p.source ? `src:${p.source}` : null,
              ].filter((b): b is string => !!b)}
              actions={[
                { label: "Call", onClick: () => {/* dial */} },
                { label: "Text", onClick: () => {/* sms */} },
                { label: "Bad #", onClick: () => {/* mark bad */} },
              ]}
            />
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">Emails</h4>
        <div className="space-y-2">
          {emails.length === 0 && <EmptyRow label="No email hits" />}
          {emails.map((e, idx) => (
            <ContactRow
              key={idx}
              icon={<MailIcon size={16} />}
              value={e.value}
              meta={`${(e.confidence * 100).toFixed(0)}%`}
              badges={[e.source ? `src:${e.source}` : null].filter((b): b is string => !!b)}
              actions={[
                { label: "Email", onClick: () => {/* compose */} },
                { label: "Bad", onClick: () => {/* mark bad */} },
              ]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  value,
  meta,
  badges,
  actions,
}: {
  icon: React.ReactNode;
  value: string;
  meta?: string;
  badges?: string[];
  actions?: { label: string; onClick: () => void }[];
}) {
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-gray-500">{icon}</span>
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-gray-500">{meta}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {badges?.map((b) => (
              <span key={b} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {actions?.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="rounded border px-2 py-1 text-xs"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="rounded border px-3 py-2 text-sm text-gray-500">{label}</div>;
}
