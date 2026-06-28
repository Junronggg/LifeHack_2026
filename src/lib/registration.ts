/**
 * Registration submission.
 *
 * Sends the form data to a Google Apps Script web app, which appends a row to a
 * shared Google Sheet and emails the participant their check-in QR code.
 *
 * Set the endpoint in `.env.local`:
 *   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
 *
 * If the variable is not set, the form runs in "demo mode": it resolves
 * successfully so the UI is testable locally, but NOTHING is saved.
 */

export type RegistrationPayload = {
  track: "Main" | "Algo";
  name: string;
  email: string;
  university?: string;
  // Main only
  role?: "captain" | "member" | "solo";
  teamCode?: string;
  teamName?: string;
  skills?: string;
  // Algo only
  codeforces?: string;
  warmupLevel?: string;
};

export async function submitRegistration(
  payload: RegistrationPayload
): Promise<void> {
  const url = import.meta.env.VITE_APPS_SCRIPT_URL;

  if (!url) {
    // Demo mode — no backend connected yet.
    console.warn(
      "[registration] VITE_APPS_SCRIPT_URL is not set — running in demo mode. " +
        "Data is NOT being saved. See backend/SETUP.md to connect the Google Sheet."
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    return;
  }

  // Google Apps Script does not return CORS headers, so a normal fetch would be
  // blocked by the browser and throw — even though the request DID reach the
  // script. We use mode: "no-cors" because we don't need to read the response
  // (the QR code is delivered to the participant by email). The POST still
  // arrives and the row is still written; the browser just won't expose the
  // reply to us. text/plain is a CORS-safelisted content type, so this is
  // allowed in no-cors mode and reaches Apps Script as e.postData.contents.
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}
