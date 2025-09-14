// API types for contacts
export interface Contact {
  value: string;
  type?: string;
  confidence: number;
  dnc?: boolean;
  lastSeen?: string;
  source?: string;
  isPrimary?: boolean;
}

export interface LeadContacts {
  phones: Contact[];
  emails: Contact[];
  compliance: {
    quietHours: boolean;
    leadTimezone?: string;
    dncSuppressed?: number;
  };
}

// Contacts API functions
export async function getLeadContacts(leadId: string): Promise<LeadContacts> {
  const res = await fetch(`/api/leads/${leadId}/contacts`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markContactBad(
  leadId: string, 
  payload: { 
    kind: "phone" | "email"; 
    value: string 
  }
): Promise<void> {
  const res = await fetch(`/api/leads/${leadId}/contacts/mark-bad`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function toggleDoNotContact(
  leadId: string, 
  payload: { 
    kind: "phone" | "email"; 
    value: string; 
    dnc: boolean 
  }
): Promise<void> {
  const res = await fetch(`/api/leads/${leadId}/contacts/toggle-dnc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function logContactAttempt(
  leadId: string, 
  payload: { 
    channel: "call" | "sms" | "email"; 
    value: string 
  }
): Promise<void> {
  const res = await fetch(`/api/leads/${leadId}/contacts/log-attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
