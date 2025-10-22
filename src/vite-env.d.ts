// FIX: Removed reference to "vite/client" to resolve a type definition error.
// The necessary 'import.meta.env' types are still defined in this file.

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MAPS_API_KEY: string;
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