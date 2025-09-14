import { useState } from "react";
import { SkipTraceModal } from "./SkipTraceModal";

type Props = { leadId: string; disabled?: boolean };

export function SkipTraceButton({ leadId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="px-3 py-1.5 rounded-md bg-indigo-600 text-white disabled:opacity-50"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Skip Trace
      </button>
      {open && (
        <SkipTraceModal
          leadId={leadId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
