// Lead-related types
export interface LeadAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  address: LeadAddress;
  email?: string;
  phone?: string;
}

// Skip Trace related types
export interface SkipTraceResult {
  leadId: string;
  success: boolean;
  phones?: {
    number: string;
    type: string;
    confidence: number;
    dnc?: boolean;
    litigator?: boolean;
  }[];
  emails?: {
    address: string;
    confidence: number;
  }[];
  cost: number;
  provider: string;
  timestamp: string;
}

export interface BulkSkipTraceResult {
  results: SkipTraceResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalCost: number;
  };
}

// Component prop types
export interface SkipTraceButtonProps {
  leadData: Lead;
  onComplete?: (result: SkipTraceResult) => void;
  buttonClassName?: string;
  buttonText?: string;
}

export interface SkipTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadData: Lead;
  onComplete?: (result: SkipTraceResult) => void;
}

export interface BulkSkipTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadsData: Lead[];
  onComplete?: (results: BulkSkipTraceResult) => void;
}

export interface LeadContactsPanelProps {
  leadId: string;
  skipTraceResults?: SkipTraceResult;
}

export interface SkipTraceDashboardWidgetProps {
  period?: 'day' | 'week' | 'month' | 'year';
}
