import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeadContacts, markContactBad, toggleDoNotContact, logContactAttempt } from "../../services/contactsAPI";
import { PhoneIcon, MailIcon, ShieldAlert, CheckCircle2 } from "lucide-react";

type Props = { leadId: string };

export function LeadContactsPanel({ leadId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["leadContacts", leadId],
    queryFn: () => getLeadContacts(leadId),
  });

  const mBad = useMutation({
    mutationFn: (payload: { kind: "phone" | "email"; value: string }) =>
      markContactBad(leadId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leadContacts", leadId] }),
  });

  const mDnc = useMutation({
    mutationFn: (payload: { kind: "phone" | "email"; value: string; dnc: boolean }) =>
      toggleDoNotContact(leadId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leadContacts", leadId] }),
  });

  const mLog = useMutation({
    mutationFn: (payload: { channel: "call" | "sms" | "email"; value: string }) =>
      logContactAttempt(leadId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leadContacts", leadId] }),
  });

  const bestPhones = useMemo(() => {
    const list = data?.phones ?? [];
    return [...list]
      .filter(p => !p.dnc)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 2);
  }, [data]);

  if (isLoading) return <PanelShell title="Contacts"><div className="text-sm text-gray-500">Loading contacts…</div></PanelShell>;
  if (error) return <PanelShell title="Contacts"><div className="text-sm text-red-600">Failed to load contacts</div></PanelShell>;
  if (!data) return null;

  return (
    <PanelShell title="Contacts">
      {/* Best Contacts */}
      <section className="mb-4">
        <h4 className="mb-2 text-sm font-semibold">Best Contact(s)</h4>
        {bestPhones.length === 0 ? (
          <EmptyRow label="No high-confidence phone numbers yet." />
        ) : (
          <div className="space-y-2">
            {bestPhones.map((p, i) => (
              <ContactRow
                key={i}
                icon={<PhoneIcon size={16} />}
                value={p.value}
                meta={`${p.type ?? "phone"} • ${(p.confidence * 100).toFixed(0)}% • ${p.source ?? "provider"}`}
                dnc={!!p.dnc}
                badges={[
                  p.lastSeen ? `seen:${p.lastSeen}` : null,
                ].filter(Boolean) as string[]}
                actions={[
                  { label: "Call", onClick: () => mLog.mutate({ channel: "call", value: p.value }) },
                  { label: "Text", onClick: () => mLog.mutate({ channel: "sms", value: p.value }) },
                  { label: "Bad #", onClick: () => mBad.mutate({ kind: "phone", value: p.value }) },
                  {
                    label: p.dnc ? "Allow" : "DNC",
                    onClick: () => mDnc.mutate({ kind: "phone", value: p.value, dnc: !p.dnc }),
                  },
                ]}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Phones */}
        <section>
          <h4 className="mb-2 text-sm font-semibold">Phones</h4>
          <div className="space-y-2">
            {(data.phones ?? []).length === 0 && <EmptyRow label="No phone results." />}
            {(data.phones ?? []).map((p, idx) => (
              <ContactRow
                key={idx}
                icon={<PhoneIcon size={16} />}
                value={p.value}
                meta={`${p.type ?? "phone"} • ${(p.confidence * 100).toFixed(0)}% • ${p.source ?? "provider"}`}
                dnc={!!p.dnc}
                badges={[
                  p.lastSeen ? `seen:${p.lastSeen}` : null,
                ].filter(Boolean) as string[]}
                actions={[
                  { label: "Call", onClick: () => mLog.mutate({ channel: "call", value: p.value }) },
                  { label: "Text", onClick: () => mLog.mutate({ channel: "sms", value: p.value }) },
                  { label: "Bad #", onClick: () => mBad.mutate({ kind: "phone", value: p.value }) },
                  {
                    label: p.dnc ? "Allow" : "DNC",
                    onClick: () => mDnc.mutate({ kind: "phone", value: p.value, dnc: !p.dnc }),
                  },
                ]}
              />
            ))}
          </div>
        </section>

        {/* Emails */}
        <section>
          <h4 className="mb-2 text-sm font-semibold">Emails</h4>
          <div className="space-y-2">
            {(data.emails ?? []).length === 0 && <EmptyRow label="No email results." />}
            {(data.emails ?? []).map((e, idx) => (
              <ContactRow
                key={idx}
                icon={<MailIcon size={16} />}
                value={e.value}
                meta={`${(e.confidence * 100).toFixed(0)}% • ${e.source ?? "provider"}`}
                dnc={!!e.dnc}
                badges={[e.lastSeen ? `seen:${e.lastSeen}` : null].filter(Boolean) as string[]}
                actions={[
                  { label: "Email", onClick: () => mLog.mutate({ channel: "email", value: e.value }) },
                  { label: "Bad", onClick: () => mBad.mutate({ kind: "email", value: e.value }) },
                  {
                    label: e.dnc ? "Allow" : "DNC",
                    onClick: () => mDnc.mutate({ kind: "email", value: e.value, dnc: !e.dnc }),
                  },
                ]}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Compliance summary */}
      <ComplianceBar
        quietHours={!!data.compliance?.quietHours}
        dncSuppressed={data.compliance?.dncSuppressed ?? 0}
        timezone={data.compliance?.leadTimezone}
      />
    </PanelShell>
  );
}

/** ——— helpers ——— */

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ContactRow({
  icon,
  value,
  meta,
  dnc,
  badges,
  actions,
}: {
  icon: React.ReactNode;
  value: string;
  meta?: string;
  dnc?: boolean;
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
            {dnc && (
              <span className="rounded bg-rose-50 text-rose-700 px-1.5 py-0.5 text-xs">DNC</span>
            )}
            {badges?.map((b) => (
              <span key={b} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{b}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {actions?.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
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

function ComplianceBar({
  quietHours,
  dncSuppressed,
  timezone,
}: {
  quietHours: boolean;
  dncSuppressed: number;
  timezone?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
      {quietHours && (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-amber-800">
          <ShieldAlert size={14} /> Quiet hours enforced{timezone ? ` (${timezone})` : ""}
        </span>
      )}
      {dncSuppressed > 0 && (
        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-rose-700">
          <ShieldAlert size={14} /> DNC suppressed: {dncSuppressed}
        </span>
      )}
      {!quietHours && dncSuppressed === 0 && (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700">
          <CheckCircle2 size={14} /> All clear
        </span>
      )}
    </div>
  );
}
