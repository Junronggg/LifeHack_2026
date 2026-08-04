# Registration backend — setup guide

This connects the website's registration forms to a **shared Google Sheet** the
whole committee can open. Main participants immediately receive their check-in
QR inline and attached as a PNG. Algorithmic participants receive confirmation
only; their QR is sent later.

There is **no server to run or deploy** — Google hosts everything for free.

```
Main form ──POST──▶ Google Apps Script ──▶ Main sheet + attached QR email
Algo form ──POST──▶ Google Apps Script ──▶ Algo sheet + confirmation email
```

---

## Step 1 — Create the Google Sheet

1. Go to <https://sheets.google.com> → **Blank spreadsheet**.
2. Name it e.g. **"LifeHack 2026 Registrations"**.
3. Leave it for now — the script creates the tabs for you in Step 3.

## Step 2 — Add the script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete the placeholder code, paste the entire contents of [`Code.gs`](./Code.gs).
3. Click **Save** (💾).

## Step 3 — Create the tabs + headers

1. In the Apps Script editor, choose the function **`setupSheets`** from the
   dropdown at the top, then click **Run**.
2. Google asks you to **authorise** — approve it (it's your own script).
3. Back in the Sheet you'll now see two tabs with headers. In addition to the
   registration and QR fields, each tab includes:
   - `Nationality`, `FieldOfStudy`, and `YearOfStudy` from the registration form.
   - `ConfirmationEmailSent` — whether the initial confirmation was sent.
   - `CheckInEmailSent` — whether final check-in details were sent.

   If the tabs already existed, run `setupSheets` again after updating the
   script. It adds these status columns without deleting existing registrations.

   > `Type` is auto-filled **NUS / External** from the email domain — that's how
   > you track the participant mix (use a `COUNTIF` to see the %). It is computed
   > server-side and never shown to applicants.

## Step 4 — Deploy as a Web App

1. Apps Script editor → **Deploy → New deployment**.
2. Click the gear ⚙ → select **Web app**.
3. Settings:
   - **Description:** `LifeHack registrations`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**  ← required so the website can POST to it
4. **Deploy** → authorise if prompted → **copy the Web app URL**
   (looks like `https://script.google.com/macros/s/AKfyc.../exec`).

> Test it: paste that URL in a browser. You should see
> `{"ok":true,"service":"LifeHack 2026 registration"}`.

## Step 5 — Connect the website

1. In the `lifehack-2026` project, create a file named **`.env.local`**:

   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfyc.../exec
   ```

   (`.env.local` is git-ignored, so the URL never gets committed.)
2. Restart the dev server (`npm run dev`) so Vite picks up the variable.
3. Test each track with an unused email:
   - Main → a Main row and an email with the QR inline and attached.
   - Algorithmic → an Algo row and a confirmation email without a QR.

   To test only the Algorithmic email template, run
   `testAlgorithmicConfirmationEmail` from the Apps Script editor. It sends a
   confirmation to the script owner's account without adding a Sheet row.

> **Without** this variable the forms still "work" in the browser (demo mode)
> but **nothing is saved** — you'll see a warning in the browser console.

## Step 6 — Share with the committee

In the Sheet → **Share** → add committee Google accounts as **Viewer/Editor**.
**Do not** make it public — it contains students' names and emails.

## Step 7 — Audit email delivery

1. In Apps Script, run `auditDuplicateEmails` and inspect the execution log.
   Clean up any duplicates that existed before duplicate enforcement was added.
2. Check the status columns:
   - Main success: `ConfirmationEmailSent=TRUE`, `CheckInEmailSent=TRUE`.
   - Algo success: `ConfirmationEmailSent=TRUE`, `CheckInEmailSent=FALSE`.
3. Run `sendMissingRegistrationConfirmations` to retry failed initial emails.
   Resubmitting an existing registration also retries its initial email when
   `ConfirmationEmailSent` is not `TRUE`, without creating another row.
4. When Algorithmic QRs are ready to send, run `sendAllCheckInEmails`. It also
   recovers any legacy/failed Main QR rows. Rows with
   `CheckInEmailSent=TRUE` are skipped automatically.

An email may appear once in each tab, allowing the same participant to enter
both tracks. Within Main, the duplicate check prevents the same email from
creating or joining more than one team.

---

## Updating things later

- **Change a deployment** (after editing `Code.gs`): Deploy → **Manage
  deployments** → ✏️ edit → **Deploy** (keeps the same URL).
- **New QR permission:** the first run after this update may ask the script
  owner to authorise access to the external QR image service. Select
  `testImmediateQrEmail` in the Apps Script function dropdown and run it once.
  Approve the requested permissions and confirm that the test QR reaches the
  script owner's inbox before testing the public form.
- **Export to Excel:** File → Download → Microsoft Excel — this is also your
  manual / fallback check-in lookup on event day.
- **Team size limits & the 30% external cap:** these are intentionally *tracked*
  (via the `TeamCode` and `Type` columns) but not auto-enforced, so a bug can't
  block a real student. See the commented block at the bottom of `Code.gs` for
  how to turn on hard enforcement when team size is finalised.

## What's next (not built yet)

- **Check-in scanner page** — a committee-only page that scans a participant's
  QR and flips their `CheckedIn` column to `TRUE`. (Fallback today: `Ctrl+F`
  their name in the Sheet and tick the box.)
- **Dynamic sponsors & day-of problem statements** — same pattern in reverse:
  the site *reads* extra tabs, so you edit a row during the event and the page
  updates with no redeploy.
