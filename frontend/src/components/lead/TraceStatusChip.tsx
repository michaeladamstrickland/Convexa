import { TraceStatusChip as TraceStatusType } from "../../types";

interface Props {
  status: TraceStatusType;
}

export function TraceStatusChip({ status }: Props) {
  const colors = {
    Untraced: "bg-slate-100 text-slate-700",
    Partial: "bg-amber-50 text-amber-700",
    Completed: "bg-emerald-50 text-emerald-700",
    "No-Hit": "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        colors[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}
