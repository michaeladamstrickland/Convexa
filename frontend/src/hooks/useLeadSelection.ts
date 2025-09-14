import { useState } from "react";
import { Lead } from "../types";

export function useLeadSelection() {
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };

  const selectAllLeads = (leads: Lead[]) => {
    setSelectedLeadIds(leads.map(lead => lead.id));
  };

  const clearLeadSelection = () => {
    setSelectedLeadIds([]);
  };

  return {
    selectedLeadIds,
    toggleLeadSelection,
    selectAllLeads,
    clearLeadSelection,
    hasSelection: selectedLeadIds.length > 0
  };
}
