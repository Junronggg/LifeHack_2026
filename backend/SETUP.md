# Registration backend — setup guide

This connects the website's registration forms to a **shared Google Sheet** the
whole committee can open. Registration sends a plain confirmation email. After
registration closes, the committee runs one bulk function to send consolidated
check-in IDs and QR links.

There is **no server to run or deploy** — Google hosts everything for free.

```
Website form ──POST──▶ Google Apps Script ──▶ Google Sheet (committee opens this)
                              └──────────────▶ registration confirmation

After registration closes ──▶ sendAllCheckInEmails() ──▶ check-in details
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
3. Submit a test registration on the site → a new row appears in the Sheet and
   a plain registration-confirmation email arrives. No QR is sent yet.

> **Without** this variable the forms still "work" in the browser (demo mode)
> but **nothing is saved** — you'll see a warning in the browser console.

## Step 6 — Share with the committee

In the Sheet → **Share** → add committee Google accounts as **Viewer/Editor**.
**Do not** make it public — it contains students' names and emails.

## Step 7 — Close registration and send check-in details

1. Stop or close public registration before sending the final batch.
2. In Apps Script, run `auditDuplicateEmails` and inspect the execution log.
   Clean up any duplicates that existed before duplicate enforcement was added.
3. Run `sendAllCheckInEmails` manually.
4. Check the execution log for sent/failed counts and remaining email quota.
5. If quota or a transient error interrupts the batch, run the same function
   again later. Rows with `CheckInEmailSent=TRUE` are skipped automatically.

Participants registered for both Main and Algo receive one consolidated email
when both rows are unsent at the time the batch runs.

If an initial confirmation failed, run `sendMissingRegistrationConfirmations`.
Only rows with `ConfirmationEmailSent` not set to `TRUE` are retried.

---

## Updating things later

- **Change a deployment** (after editing `Code.gs`): Deploy → **Manage
  deployments** → ✏️ edit → **Deploy** (keeps the same URL).
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
