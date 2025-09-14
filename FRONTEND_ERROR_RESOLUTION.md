# Frontend Console Error Troubleshooting Guide

This guide addresses the console errors currently appearing in the FlipTracker application.

## React Router Future Flag Warning

**Error:**
```
React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7.
```

**Solution:**
Add the future flag to your Router configuration:

```jsx
// In your main router file (likely App.tsx or index.tsx)
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true
  }
});
```

## MUI Grid Deprecation Warnings

**Errors:**
```
MUI Grid: The `item` prop has been removed and is no longer necessary.
MUI Grid: The `xs` prop has been removed.
MUI Grid: The `md` prop has been removed.
MUI Grid: The `sm` prop has been removed.
```

**Solution:**
You're using Material UI Grid v2, but your components are using the deprecated v1 API. Update your Grid components according to the migration guide:

```jsx
// OLD way (v1)
<Grid item xs={12} md={6}>
  {/* content */}
</Grid>

// NEW way (v2)
<Grid xs={12} md={6}>
  {/* content */}
</Grid>
```

For a complete migration, find all Grid components in your codebase and:
1. Remove all `item` props
2. Keep the sizing props but review the documentation at https://mui.com/material-ui/migration/upgrade-to-grid-v2/

## API 404 Error

**Error:**
```
Failed to load resource: the server responded with a status of 404 (Not Found)
POST http://localhost:5001/api/zip-search-new/add-lead 404 (Not Found)
```

**Solution:**
The endpoint `/api/zip-search-new/add-lead` doesn't exist on your backend server. Check:

1. That the backend server is running on port 5001
2. That the API endpoint path is correct
3. If the endpoint was renamed or moved, update the frontend code

In `AttomLeadGenerator.jsx`, look for the API call around line 268 and update the endpoint:

```jsx
// Check if the correct endpoint is:
axios.post('/api/zip-search/add-lead', leadData);
// Or possibly:
axios.post('/api/leads/add', leadData);
```

## Aria-hidden Accessibility Warning

**Error:**
```
Blocked aria-hidden on an element because its descendant retained focus.
```

**Solution:**
There's an accessibility issue with modal dialogs. When a modal opens, it sets `aria-hidden="true"` on the main app container, but a focusable element inside still has focus.

1. Check your modal implementation in the codebase
2. Ensure focus is properly trapped inside the modal when it opens
3. Consider using the `inert` attribute as suggested by the error message

## Implementation Steps

### 1. Fix React Router Warning

Find the router configuration file and add the future flag:

```jsx
// In src/index.tsx or App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Add this to your BrowserRouter
<BrowserRouter future={{ v7_relativeSplatPath: true }}>
  <Routes>
    {/* Your routes */}
  </Routes>
</BrowserRouter>
```

### 2. Update MUI Grid Components

Start with the components mentioned in the error stack:
- `AttomLeadGenerator.jsx` 
- Layout components

Remove `item` props and review breakpoint props according to Grid v2 documentation.

### 3. Fix API Endpoint

Check the backend routes configuration to identify the correct API endpoint for adding leads. Then update the frontend code in `AttomLeadGenerator.jsx` to use the correct endpoint.

### 4. Fix Accessibility Issue

Review modal dialog implementations to ensure proper focus management.
