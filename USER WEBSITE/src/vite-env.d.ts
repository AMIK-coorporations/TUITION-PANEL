/// <reference types="vite/client" />

// Typed environment variables. Without this file `import.meta.env` is
// untyped, so a typo in a variable name fails silently at runtime instead of
// at build time.
interface ImportMetaEnv {
  readonly VITE_INSFORGE_URL: string;
  readonly VITE_INSFORGE_ANON_KEY: string;
  /** Optional override for the English-language unlock code. */
  readonly VITE_ENGLISH_ACCESS_CODE?: string;
  /** Optional override for the Super Admin panel code. */
  readonly VITE_ADMIN_ACCESS_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}