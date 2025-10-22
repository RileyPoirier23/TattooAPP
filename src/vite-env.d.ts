// FIX: Removed `/// <reference types="vite/client" />` to resolve a "Cannot find type definition file" error. The necessary types are defined manually below.

// Fix: Manually define types for Vite's `import.meta.env` to resolve TypeScript errors.
// This provides the necessary type information for environment variables when the default
// `vite/client` types are not being picked up by the TypeScript compiler.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MAPS_API_KEY: string;
  readonly VITE_API_KEY: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Consolidate global window property declarations here to avoid errors and maintain clean code.
interface Window {
  google: any;
  gm_authFailure: () => void;
  inkspaceGoogleMapsLoaded: () => void;
  Stripe: any;
}
