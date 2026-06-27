/**
 * LifeHack 2026 — Registration backend (Google Apps Script)
 * --------------------------------------------------------------------------
 * This script lives INSIDE the Google Sheet that the committee shares.
 * It receives registrations from the website, appends one row per person,
 * and emails each participant their check-in QR code.
 *
 * SETUP (once):
 *   1. In your Google Sheet:  Extensions → Apps Script
 *   2. Paste this whole file, Save.
 *   3. Run `setupSheets` once (creates the Main + Algo tabs with headers,
 *      and authorise when prompted).
 *   4. Deploy → New deployment → type "Web app"
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Copy the /exec URL → put it in the website's .env.local as
 *      VITE_APPS_SCRIPT_URL.
 *
 * To re-deploy after editing: Deploy → Manage deployments → edit → Deploy.
 */

// --- Config -----------------------------------------------------------------
var MAIN_TAB = "Main";
var ALGO_TAB = "Algo";
var NUS_DOMAIN = "@u.nus.edu"; // adjust if you also accept @nus.edu.sg etc.
var EVENT_NAME = "LifeHack 2026";

var MAIN_HEADERS = [
  "Timestamp", "Name", "Email", "University", "Type",
  "Role", "TeamCode", "TeamName", "Skills", "QR_ID", "CheckedIn",
];
var ALGO_HEADERS = [
  "Timestamp", "Name", "Email", "University", "Type",
  "Codeforces", "WarmupLevel", "QR_ID", "CheckedIn",
];

// --- Entry point: receives a registration from the website ------------------
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var isAlgo = d.track === "Algo";
    var sheet = ss.getSheetByName(isAlgo ? ALGO_TAB : MAIN_TAB);
    if (!sheet) throw new Error("Run setupSheets() first — tab not found.");

    var email = (d.email || "").trim();
    var isNUS = email.toLowerCase().slice(-NUS_DOMAIN.length) === NUS_DOMAIN;
    var type = isNUS ? "NUS" : "External";
    var qrId = Utilities.getUuid();

    if (isAlgo) {
      sheet.appendRow([
        new Date(), d.name || "", email, d.university || "", type,
        d.codeforces || "", d.warmupLevel || "", qrId, false,
      ]);
    } else {
      sheet.appendRow([
        new Date(), d.name || "", email, d.university || "", type,
        d.role || "", d.teamCode || "", d.teamName || "", d.skills || "",
        qrId, false,
      ]);
    }

    if (email) sendQrEmail(email, d.name, qrId);

    return jsonOut({ ok: true, qrId: qrId });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// --- Health check (open the /exec URL in a browser to test) -----------------
function doGet() {
  return jsonOut({ ok: true, service: EVENT_NAME + " registration" });
}

// --- Email the participant their QR code ------------------------------------
function sendQrEmail(email, name, qrId) {
  var qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" +
    encodeURIComponent(qrId);
  var html =
    "<p>Hi " + (name || "there") + ",</p>" +
    "<p>You're registered for <b>" + EVENT_NAME + "</b>. " +
    "Show this QR code at check-in on event day:</p>" +
    "<p><img src='" + qrUrl + "' alt='Check-in QR' width='200' height='200'/></p>" +
    "<p>If the image doesn't load, your check-in ID is:<br><b>" + qrId + "</b></p>" +
    "<p>See you there,<br>NUS Computing Club</p>";
  MailApp.sendEmail({
    to: email,
    subject: "Your " + EVENT_NAME + " check-in QR",
    htmlBody: html,
  });
}

// --- Run ONCE from the editor to create the tabs + headers ------------------
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureTab(ss, MAIN_TAB, MAIN_HEADERS);
  ensureTab(ss, ALGO_TAB, ALGO_HEADERS);
}

function ensureTab(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/* ---------------------------------------------------------------------------
 * OPTIONAL: hard cap on external (non-NUS) participants.
 * The brief asks to track a max 30% external mix — but it must NOT be shown to
 * applicants. Tracking is already done via the "Type" column (use a COUNTIF).
 * If you later want to AUTO-WAITLIST once external > 30%, drop this check near
 * the top of doPost (after computing isNUS), and add a "Waitlist" column:
 *
 *   if (!isNUS) {
 *     var rows = sheet.getDataRange().getValues();      // includes header
 *     var total = rows.length - 1;
 *     var ext = 0;
 *     for (var i = 1; i < rows.length; i++) if (rows[i][4] === "External") ext++;
 *     var waitlisted = (ext + 1) > Math.floor((total + 1) * 0.30);
 *     // ...append with a Waitlist flag instead of rejecting outright...
 *   }
 *
 * Likewise, team min/max size can be enforced by counting rows with the same
 * TeamCode before appending. Keeping it out of the default path so a bug can
 * never accidentally block a real student's registration.
 * ------------------------------------------------------------------------- */
