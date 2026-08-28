# LifeHack 2026 — Event Timeline

One source file, three deliverables: the website, the PDF, and the QR codes.

```
index.html                      the whole site — self-contained, no build, no dependencies
LifeHack-2026-Timeline.pdf      3-page PDF rendered from index.html
make-qr.py                      regenerates the QR codes
qr/                             qr-white-on-navy · qr-navy-on-white · qr-gold-on-navy · qr.svg
```

Content comes from `LifeHack_2026_Event_Proposal.docx` v2.1, section 4.

## Before it goes live

1. **The proposal calls the schedule indicative.** Once the committee locks the
   timings, delete the `INDICATIVE` badge near the top of `index.html` (it is
   marked with an HTML comment). Two open items from the proposal are reflected
   on the page: overnight venue access is pending OSA approval, and the
   Algorithmic Hackathon room is listed as still to be decided.
2. **Point the QR at the real URL:**
   ```
   pip install qrcode pillow
   python3 make-qr.py https://your-final-url
   ```
3. **Re-render the PDF** after any edit (see below).

## Editing the schedule

Each event is one `<li class="ev">` block. Copy an existing one and change the text.

- `data-s` / `data-e` — start and end, `YYYY-MM-DDTHH:MM`, Singapore time. These drive
  the live countdown and the "LIVE NOW" highlight, so keep them in sync with the
  visible time.
- `data-track` — `all`, `main` or `algo`. Controls the track filter buttons.
- `class="ev key"` — promotes an event to a gold milestone card. Use sparingly.

The countdown targets are hard-coded near the bottom of the file:

```js
var START  = new Date('2026-08-29T11:00:00+08:00');   // problem statements released
var SUBMIT = new Date('2026-08-30T11:00:00+08:00');   // Devpost form locks
```

## Preview locally

```bash
python3 -m http.server 8731 --directory /Users/marcus/Downloads/lifehack-timeline
```

## Re-render the PDF

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 --print-to-pdf="/Users/marcus/Downloads/lifehack-timeline/LifeHack-2026-Timeline.pdf" "http://localhost:8731/index.html"
```

Or just open the page and hit Cmd+P → Save as PDF, with **Background graphics** ticked.

## Deploy

It is a single static file. Any of these work:

- **GitHub Pages** — commit `index.html` to a repo, enable Pages on the branch.
- **Vercel / Netlify** — drag the folder onto the dashboard.
- **Existing site** — drop `index.html` at `lifehack2026.nuscomputing.com/timeline/`.

## Notes

- The QR-scanning audience is on a phone, so the page is mobile-first. Check it at
  375px wide before shipping.
- Light-background QR (`qr-navy-on-white`) scans most reliably. Use the inverted
  versions only on the dark posters.
- The partner line and the NUSSU sponsor disclaimer name all three companies
  (Rezolve AI, Visa, Ecovolt Technologies). They are in the footer and repeat on every
  page of the PDF. Do not remove them.
- The PDF is two pages, one per day.
