# LifeHack 2026 staff QR check-in setup

The live camera scanner must be hosted on the normal LifeHack website. Google
Apps Script HTML pages run inside a Google-controlled iframe that blocks camera
access on mobile browsers.

The final architecture is:

```
LifeHack website scanner -> Apps Script check-in endpoint -> Main/Algo Sheet
```

## 1. Update the Apps Script backend

1. Open the registration Google Sheet.
2. Select **Extensions -> Apps Script**.
3. Replace the complete Apps Script `Code.gs` with `backend/Code.gs` from this
   repository and save it.
4. Select `setupSheets` in the function dropdown and click **Run**.
5. Confirm both `Main` and `Algo` have `QR_ID`, `CheckedIn`, `CheckedInAt`, and
   `CheckedInBy` columns.
6. In **Project Settings -> Script Properties**, create `CHECKIN_PIN` with a
   random 6-8 digit value.

`CheckIn.html` is no longer used for live camera scanning. It may remain in the
Apps Script project, but staff should not use its `?page=checkin` URL.

## 2. Redeploy the Apps Script staff endpoint

1. Select **Deploy -> Manage deployments**.
2. Edit the staff check-in deployment.
3. Select **New version**.
4. Keep **Execute as: Me** and **Who has access: Anyone**.
5. Click **Deploy**.
6. Keep the `/exec` URL. Do not append `?page=checkin`; the website uses this
   URL as its backend.

The production value currently configured in `.env.production` is:

```
VITE_CHECKIN_SCRIPT_URL=https://script.google.com/macros/s/AKfycbxNoL6AFA5S0hqCiZ-UgAzG1-0SUV9OuKZKwvE2OmhTuMa2RgicWoJQSI48Flhghvvu/exec
```

If Google gives you a different deployment URL, update that environment value
before building the website.

## 3. Deploy the LifeHack website

The new website files are:

- `src/components/CheckInScanner.tsx`
- `src/components/CheckInScanner.css`
- the scanner selection in `src/main.tsx`
- the `html5-qrcode` package in `package.json`

Run `npm install`, then `npm run build`, and deploy the generated `dist` folder
through the same hosting process used for the main LifeHack website.

The staff scanner URL is now the website URL with `?page=checkin`, for example:

```
https://YOUR-LIFEHACK-WEBSITE.example/?page=checkin
```

Do not give staff the `script.google.com/.../exec?page=checkin` URL.

## 4. Test on a phone

1. Open the LifeHack website scanner URL directly in Chrome or Safari.
2. Enter a desk label and the staff PIN.
3. Tap **Open scanner** and allow camera access.
4. Scan one Main and one Algo QR.
5. Confirm participant details appear and the Sheet records `CheckedIn=TRUE`,
   the time, and the staff label.
6. Scan the same QR again and confirm `ALREADY CHECKED IN` appears.
7. Reset the test rows after testing.

## 5. Event-day operation

1. Each staff member opens the LifeHack website scanner URL.
2. They enter their desk label and PIN and allow camera access.
3. They scan the participant QR. The Sheet is updated automatically and the
   participant information appears on the phone.
4. They verify the displayed name and tap **Scan next participant**.

Green means checked in, yellow means already checked in, and red means invalid
or failed. Automatic check-in needs internet, so keep a hotspot and an exported
participant list at the problem desk.
