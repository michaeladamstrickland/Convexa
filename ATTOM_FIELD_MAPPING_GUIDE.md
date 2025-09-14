# ATTOM API Integration - Field Mapping & Data Handling Guide

## Overview

This document outlines the approach to handling inconsistent field names and data structures from the ATTOM API responses. The ATTOM API has inconsistent field naming across different endpoints and property types, requiring a robust approach to data access.

## Key Issues Addressed

1. **Inconsistent Field Names**: The same property attribute may be available under different field names (e.g., `yearbuilt` vs `yearBuilt`)
2. **Nested Property Access**: Property data is deeply nested in response objects
3. **Missing Fields**: Not all properties have the same set of fields available
4. **Null/Undefined Handling**: Need for consistent handling of missing values

## Solutions Implemented

### Backend (`attom-routes.js`)

1. **Enhanced Field Mapping**:
   - Each field now checks multiple possible paths in the API response
   - Example: `propertyType: prop.summary?.proptype || prop.summary?.propertyType || prop.summary?.propType`

2. **Improved Error Handling**:
   - Added retry logic for API requests (up to 3 retries)
   - Better error reporting with context

3. **Debug Logging**:
   - Enhanced `logValue()` function shows field values and paths
   - Debug information included in responses for troubleshooting

4. **Parallel API Requests**:
   - Making multiple API calls in parallel to gather complete property data
   - Fallback handling when specific endpoints fail

### Frontend (`PropertyDetailEnhanced.jsx`)

1. **Safe Data Access Helpers**:
   ```javascript
   // Helper function for safely accessing nested properties
   const getNestedValue = (obj, path, defaultValue = 'N/A') => {
     try {
       const result = path.split('.').reduce((o, key) => o && o[key] !== undefined ? o[key] : undefined, obj);
       return result !== undefined && result !== null ? result : defaultValue;
     } catch (e) {
       console.log(`Error getting nested value for path ${path}:`, e);
       return defaultValue;
     }
   };
   ```

2. **Numeric Formatting with Fallbacks**:
   ```javascript
   const formatNumber = (value, defaultValue = 'N/A') => {
     if (value === undefined || value === null) return defaultValue;
     if (isNaN(value)) return defaultValue;
     return Number(value).toLocaleString();
   };
   ```

3. **Component Property Access**:
   - Using helper functions for all property data access
   - Example: `{getNestedValue(property, 'yearBuilt', 'N/A')}`

## Testing & Verification

1. **Test Script**: Use `test-attom-api.js` to verify API responses
2. **Response Debugging**: 
   - Debug information available in `/property/:attomId/detail` endpoint
   - Check console logs for detailed field mapping
3. **Field Mapping Validation**:
   - Verified each field is correctly mapped from various possible paths
   - Added fallbacks for all critical fields

## Maintenance Guidelines

1. **Adding New Fields**:
   - Always check multiple possible paths in ATTOM API responses
   - Use the pattern: `field: logValue('field', path1 || path2 || path3)`

2. **Handling Edge Cases**:
   - Always provide default values for UI components
   - Use safe data access patterns consistently

3. **Debugging Issues**:
   - Check API responses saved as JSON files during testing
   - Look for alternative field paths in raw API responses
   - Verify case sensitivity in field names

## Known API Field Inconsistencies

- **Property Type**: Available as `proptype`, `propertyType`, or `propType`
- **Year Built**: Available as `yearbuilt` or `yearBuilt` 
- **Square Footage**: Available in multiple fields:
  - `building.size.universalsize`
  - `building.size.universalSize`
  - `building.size.livingsize`
  - `building.size.bldgsize`

## Conclusion

This implementation provides a robust approach to handling the inconsistent field naming and structure of ATTOM API responses. By checking multiple possible paths and providing fallback values, we ensure a consistent and reliable user experience despite backend inconsistencies.
