# Skip Trace UI Components

This directory contains the UI components for the skip trace feature in Convexa AI. These components allow users to run single and bulk traces, see confidence-ranked results, stay compliant, and track cost without leaving Convexa.

## Components Overview

### Skip Trace Button
The `SkipTraceButton` component provides a button that triggers a modal for running a skip trace on a single lead.

```tsx
import { SkipTraceButton } from "../components";

// Usage
<SkipTraceButton 
  leadData={lead}
  onComplete={(result) => console.log(result)}
  buttonText="Skip Trace"
  buttonClassName="custom-button-class" 
/>
```

### Skip Trace Modal
The `SkipTraceModal` component displays a modal with skip trace options and results for a single lead.

```tsx
import { SkipTraceModal } from "../components";

// Usage
<SkipTraceModal 
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  leadData={lead}
  onComplete={(result) => console.log(result)} 
/>
```

### Bulk Skip Trace Modal
The `BulkSkipTraceModal` component allows users to skip trace multiple leads at once.

```tsx
import { BulkSkipTraceModal } from "../components";

// Usage
<BulkSkipTraceModal 
  isOpen={isBulkModalOpen}
  onClose={() => setIsBulkModalOpen(false)}
  leadsData={selectedLeads}
  onComplete={(results) => console.log(results)} 
/>
```

### Lead Contacts Panel
The `LeadContactsPanel` component displays contact information for a lead, including skip trace results.

```tsx
import { LeadContactsPanel } from "../components";

// Usage
<LeadContactsPanel 
  leadId={leadId}
  skipTraceResults={skipTraceResults} 
/>
```

### Skip Trace Dashboard Widget
The `SkipTraceDashboardWidget` component displays key metrics for skip tracing.

```tsx
import { SkipTraceDashboardWidget } from "../components";

// Usage
<SkipTraceDashboardWidget period="month" />
```

## Integration Examples

You can find integration examples in:

1. `frontend/src/pages/leads/LeadManagementPage.tsx` - Shows how to integrate both single and bulk skip trace in a leads table
2. `frontend/src/pages/leads/LeadDetailPage.tsx` - Shows how to use the LeadContactsPanel in a lead details page
3. `frontend/src/pages/dashboard/DashboardPage.tsx` - Shows how to use the dashboard widget

## Types

All component props and data structures are defined in `frontend/src/types/skiptrace.ts`.

## API Integration

These components expect backend endpoints for:

1. `POST /api/skip-trace` - For single lead skip tracing
2. `POST /api/skip-trace/bulk` - For bulk lead skip tracing
3. `GET /api/skip-trace/metrics` - For dashboard metrics
4. `GET /api/skip-trace/{leadId}` - For retrieving skip trace results for a specific lead
