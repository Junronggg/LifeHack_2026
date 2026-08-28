/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Apps Script web-app URL that receives registrations. */
  readonly VITE_APPS_SCRIPT_URL?: string;
  /** Separate Apps Script deployment that handles staff check-in requests. */
  readonly VITE_CHECKIN_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
