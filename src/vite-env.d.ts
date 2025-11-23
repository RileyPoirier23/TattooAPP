// This provides types for Vite's `import.meta.env` feature.
// The original `/// <reference types="vite/client" />` was failing,
// so this is a manual definition to achieve the same result.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MAPS_API_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}