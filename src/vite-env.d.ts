/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Apps Script web-app URL that receives registrations. */
  readonly VITE_APPS_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
