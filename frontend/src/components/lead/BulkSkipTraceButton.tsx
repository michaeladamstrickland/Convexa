import { useState } from "react";
import { BulkSkipTraceModal } from "../skiptrace/BulkSkipTraceModal";

type Props = {
  selectedLeadIds: string[];
  disabled?: boolean;
};

export function BulkSkipTraceButton({ selectedLeadIds, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="px-3 py-1.5 rounded-md bg-indigo-600 text-white disabled:opacity-50"
        onClick={() => setOpen(true)}
        disabled={disabled || selectedLeadIds.length === 0}
      >
        Bulk Skip Trace {selectedLeadIds.length > 0 && `(${selectedLeadIds.length})`}
      </button>
      
      {open && (
        <BulkSkipTraceModal
          leadIds={selectedLeadIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
