// Global shims to smooth TypeScript errors across library version differences and optional deps

// MUI Grid variations
declare module '@mui/material/Grid' {
  const Grid: any;
  export type GridProps = any;
  export default Grid;
}

declare module '@mui/material/Grid2' {
  const Grid: any;
  export type Grid2Props = any;
  export default Grid;
}

declare module '@mui/material/Unstable_Grid2' {
  const Grid: any;
  export type Grid2Props = any;
  export default Grid;
}

// MUI X Data Grid (optional dependency in some views)
declare module '@mui/x-data-grid' {
  export const DataGrid: any;
  export type GridColDef = any;
}

// Form libs used in optional views
declare module 'formik' {
  export const useFormik: any;
}

declare module 'yup' {
  const yup: any;
  export = yup;
}

// Optional internal service that may not be present in all setups
declare module '../../services/scraperApi' {
  export const scraperApi: any;
}

// Google Maps on window
declare global {
  interface Window {
    google?: any;
  }
}

export {};
