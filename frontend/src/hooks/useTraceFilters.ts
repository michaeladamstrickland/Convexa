import { useState, useMemo } from "react";
import { Lead, TraceStatusChip } from "../types";

type TraceFilter = "All" | "Needs Trace" | "Traced (no hit)" | "High confidence only";

export function useTraceFilters(leads: Lead[]) {
  const [filter, setFilter] = useState<TraceFilter>("All");
  
  const filteredLeads = useMemo(() => {
    if (filter === "All") {
      return leads;
    } else if (filter === "Needs Trace") {
      return leads.filter(lead => lead.traceStatus === "Untraced");
    } else if (filter === "Traced (no hit)") {
      return leads.filter(lead => lead.traceStatus === "No-Hit");
    } else if (filter === "High confidence only") {
      return leads.filter(lead => lead.phoneConfidence && lead.phoneConfidence >= 0.8);
    }
    return leads;
  }, [leads, filter]);
  
  return {
    filter,
    setFilter,
    filteredLeads,
    filters: ["All", "Needs Trace", "Traced (no hit)", "High confidence only"] as TraceFilter[]
  };
}
