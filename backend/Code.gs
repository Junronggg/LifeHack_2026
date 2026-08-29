/**
 * LifeHack 2026 — Registration backend (Google Apps Script)
 *
 * Main registration immediately emails the participant their check-in QR.
 * Algorithmic registration sends confirmation only; its QR is sent later with
 * sendAllCheckInEmails().
 *
 * Duplicate rule:
 * - An email can appear only once in Main and only once in Algo.
 * - The same email may appear once in each tab.
 *
 * After editing: Deploy → Manage deployments → Edit → New version → Deploy.
 */

var MAIN_TAB = "Main";
var ALGO_TAB = "Algo";
var NUS_DOMAIN = "@u.nus.edu";
var EVENT_NAME = "LifeHack 2026";
var EVENT_DATE = "29–30 August 2026";
var EVENT_LOCATION = "NUS School of Computing";

var MAIN_HEADERS = [
  "Timestamp", "Name", "Email", "University", "Type",
  "Nationality", "FieldOfStudy", "YearOfStudy",
  "Role", "TeamCode", "TeamName", "Skills",
  "QR_ID", "CheckedIn", "CheckedInAt", "CheckedInBy",
  "ConfirmationEmailSent", "CheckInEmailSent",
  "ReminderEmailSent", "ReminderEmailSentAt", "ReminderEmailError",
  "SoloTeamEmailSent", "SoloTeamEmailSentAt", "SoloTeamEmailError",
];

var ALGO_HEADERS = [
  "Timestamp", "Name", "Email", "University", "Type",
  "Nationality", "FieldOfStudy", "YearOfStudy",
  "Codeforces", "WarmupLevel",
  "QR_ID", "CheckedIn", "CheckedInAt", "CheckedInBy",
  "ConfirmationEmailSent", "CheckInEmailSent",
];

// Website registration endpoint.
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No registration data received.");
    }

    var data = JSON.parse(e.postData.contents);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var isAlgo = data.track === "Algo";
    var sheet = spreadsheet.getSheetByName(isAlgo ? ALGO_TAB : MAIN_TAB);

    if (!sheet) {
      throw new Error("Registration tab not found. Run setupSheets() first.");
    }

    var name = String(data.name || "").trim();
    var email = normalizeEmail(data.email);

    if (!name) throw new Error("Participant name is required.");
    if (!email || !isValidEmail(email)) {
      throw new Error("A valid participant email is required.");
    }

    var record = {
      Timestamp: new Date(),
      Name: name,
      Email: email,
      University: data.university || "",
      Type: isNusEmail(email) ? "NUS" : "External",
      Nationality: data.nationality || "",
      FieldOfStudy: data.fieldOfStudy || "",
      YearOfStudy: data.yearOfStudy || "",
      QR_ID: Utilities.getUuid(),
      CheckedIn: false,
      ConfirmationEmailSent: false,
      CheckInEmailSent: false,
    };

    if (isAlgo) {
      record.Codeforces = data.codeforces || "";
      record.WarmupLevel = data.warmupLevel || "";
    } else {
      record.Role = data.role || "";
      record.TeamCode = data.teamCode || "";
      record.TeamName = data.teamName || "";
      record.Skills = data.skills || "";
    }

    var rowNumber;
    var existingRegistration = null;
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      ensureHeaders(sheet, isAlgo ? ALGO_HEADERS : MAIN_HEADERS);

      // Uniqueness is per track/sheet. The same email may be in both tabs.
      existingRegistration = findEmailRegistration(sheet, email);
      if (existingRegistration) {
        console.warn(
          "Duplicate " + (isAlgo ? "Algo" : "Main") +
          " registration blocked for " + maskEmail(email)
        );
      } else {
        rowNumber = appendRecord(sheet, record);
      }
    } finally {
      lock.releaseLock();
    }

    if (existingRegistration) {
      var retried = retryMissingEmailForExistingRegistration(
        sheet,
        existingRegistration,
        isAlgo
      );

      return jsonOut({
        ok: false,
        code: "ALREADY_REGISTERED",
        confirmationEmailRetried: retried,
        error:
          "This email is already registered for the " +
          (isAlgo
            ? "Algorithmic Hackathon."
            : "Main Hackathon and cannot join another Main team."),
      });
    }

    // A failed email does not invalidate or duplicate the saved registration.
    var confirmationSent = false;
    var checkInSent = false;

    try {
      if (isAlgo) {
        sendAlgorithmicRegistrationConfirmation(email, name);
      } else {
        sendMainRegistrationWithQr(email, name, data, record.QR_ID);
        setCellByHeader(sheet, rowNumber, "CheckInEmailSent", true);
        checkInSent = true;
      }

      setCellByHeader(sheet, rowNumber, "ConfirmationEmailSent", true);
      confirmationSent = true;
    } catch (mailError) {
      console.error(
        "Registration saved, but " +
        (isAlgo ? "confirmation" : "QR") + " email failed for " +
        maskEmail(email) + ": " + String(mailError)
      );
    }

    return jsonOut({
      ok: true,
      confirmationEmailSent: confirmationSent,
      checkInEmailSent: checkInSent,
    });
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));

    return jsonOut({
      ok: false,
      error: String(error),
    });
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleCheckInJsonp(e);
  }

  if (e && e.parameter && e.parameter.page === "judge") {
    return HtmlService.createHtmlOutputFromFile("Judge")
      .setTitle(EVENT_NAME + " Judging Portal")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  if (e && e.parameter && e.parameter.page === "checkin") {
    return HtmlService.createHtmlOutputFromFile("CheckIn")
      .setTitle(EVENT_NAME + " Staff Check-in")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return jsonOut({
    ok: true,
    service: EVENT_NAME + " registration",
    workflow: "main-immediate-qr-algo-confirmation-v3",
  });
}

/**
 * JSONP bridge used by the top-level website scanner. Apps Script ContentService
 * does not provide browser CORS headers, so a normal cross-origin fetch cannot
 * read the result. The PIN still protects every lookup and write.
 */
function handleCheckInJsonp(e) {
  var callback = String(e.parameter.callback || "");
  if (!/^lifehackCheckIn_[A-Za-z0-9_]{1,80}$/.test(callback)) {
    return jsonOut({ ok: false, error: "Invalid callback." });
  }

  var response;
  try {
    if (e.parameter.action === "verify") {
      response = verifyCheckInAccess(e.parameter.pin, e.parameter.staffName);
    } else if (e.parameter.action === "checkin") {
      response = checkInParticipant(
        e.parameter.qrId,
        e.parameter.pin,
        e.parameter.staffName
      );
    } else {
      throw new Error("Unknown check-in action.");
    }
  } catch (error) {
    response = {
      ok: false,
      error: error && error.message ? error.message : String(error),
    };
  }

  var json = JSON.stringify(response)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return ContentService
    .createTextOutput(callback + "(" + json + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * Confirms the staff PIN before the phone camera is opened.
 * The PIN is stored in Project Settings > Script properties as CHECKIN_PIN.
 */
function verifyCheckInAccess(pin, staffName) {
  requireValidCheckInPin(pin);

  var cleanStaffName = normalizeStaffName(staffName);
  if (!cleanStaffName) {
    throw new Error("Enter your name or check-in desk.");
  }

  return { ok: true, staffName: cleanStaffName };
}

/**
 * Looks up one participant by the UUID contained in their emailed QR code and
 * atomically marks the matching Main or Algo row as checked in.
 */
function checkInParticipant(qrValue, pin, staffName) {
  requireValidCheckInPin(pin);

  var qrId = normalizeQrId(qrValue);
  var cleanStaffName = normalizeStaffName(staffName);

  if (!cleanStaffName) {
    throw new Error("Enter your name or check-in desk.");
  }
  if (!isValidQrId(qrId)) {
    return { status: "INVALID_QR" };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var targets = [
      { name: MAIN_TAB, label: "Main Hackathon", headers: MAIN_HEADERS },
      { name: ALGO_TAB, label: "Algorithmic Hackathon", headers: ALGO_HEADERS },
    ];

    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];
      var sheet = spreadsheet.getSheetByName(target.name);
      if (!sheet) continue;

      ensureHeaders(sheet, target.headers);
      var match = findQrRegistration(sheet, qrId);
      if (!match) continue;

      var record = match.record;
      if (isTrue(record.CheckedIn)) {
        return buildCheckInResult(
          "ALREADY_CHECKED_IN",
          target.label,
          record,
          record.CheckedInAt,
          record.CheckedInBy
        );
      }

      var checkedInAt = new Date();
      setCellByHeader(sheet, match.rowNumber, "CheckedIn", true);
      setCellByHeader(sheet, match.rowNumber, "CheckedInAt", checkedInAt);
      setCellByHeader(sheet, match.rowNumber, "CheckedInBy", cleanStaffName);
      SpreadsheetApp.flush();

      console.log(
        "Checked in " + maskEmail(record.Email) + " for " + target.label +
        " at " + cleanStaffName
      );

      return buildCheckInResult(
        "CHECKED_IN",
        target.label,
        record,
        checkedInAt,
        cleanStaffName
      );
    }

    return { status: "INVALID_QR" };
  } finally {
    lock.releaseLock();
  }
}

function requireValidCheckInPin(pin) {
  var expected = PropertiesService.getScriptProperties()
    .getProperty("CHECKIN_PIN");

  if (!expected) {
    throw new Error(
      "Check-in is not configured. Ask the lead to set CHECKIN_PIN in Script properties."
    );
  }
  if (String(pin || "") !== expected) {
    throw new Error("Incorrect staff PIN.");
  }
}

function normalizeStaffName(value) {
  var name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);
  // Prevent a staff-entered label from being interpreted as a Sheet formula.
  return /^[=+@]/.test(name) ? "'" + name : name;
}

function normalizeQrId(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidQrId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function findQrRegistration(sheet, qrId) {
  var rows = getRecords(sheet);

  for (var i = 0; i < rows.length; i++) {
    if (normalizeQrId(rows[i].record.QR_ID) === qrId) {
      return rows[i];
    }
  }

  return null;
}

function buildCheckInResult(status, track, record, checkedInAt, checkedInBy) {
  return {
    status: status,
    name: String(record.Name || ""),
    track: track,
    university: String(record.University || ""),
    teamName: String(record.TeamName || ""),
    role: formatRole(record.Role),
    checkedInAt: formatCheckInTime(checkedInAt),
    checkedInBy: String(checkedInBy || ""),
  };
}

function formatCheckInTime(value) {
  if (!value) return "";

  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  var timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(date, timezone, "d MMM yyyy, h:mm:ss a");
}

// A duplicate never creates another row. If its first email previously failed,
// resubmitting safely retries that missing email using the original record.
function retryMissingEmailForExistingRegistration(
  sheet,
  existingRegistration,
  isAlgo
) {
  var existing = existingRegistration.record;
  var rowNumber = existingRegistration.rowNumber;

  if (isTrue(existing.ConfirmationEmailSent)) return false;
  if (MailApp.getRemainingDailyQuota() < 1) {
    console.warn("Email quota exhausted; duplicate email retry skipped.");
    return false;
  }

  try {
    if (isAlgo) {
      sendAlgorithmicRegistrationConfirmation(
        normalizeEmail(existing.Email),
        existing.Name || "there"
      );
    } else {
      var qrId = existing.QR_ID || Utilities.getUuid();
      if (!existing.QR_ID) {
        setCellByHeader(sheet, rowNumber, "QR_ID", qrId);
      }

      sendMainRegistrationWithQr(
        normalizeEmail(existing.Email),
        existing.Name || "there",
        {
          role: existing.Role || "",
          teamName: existing.TeamName || "",
          teamCode: existing.TeamCode || "",
        },
        qrId
      );
      setCellByHeader(sheet, rowNumber, "CheckInEmailSent", true);
    }

    setCellByHeader(sheet, rowNumber, "ConfirmationEmailSent", true);
    return true;
  } catch (error) {
    console.error(
      "Existing registration email retry failed for " +
      maskEmail(existing.Email) + ": " + String(error)
    );
    return false;
  }
}

// Main confirmation containing the QR inline and as a PNG attachment.
function sendMainRegistrationWithQr(email, name, data, qrId) {
  var trackName = "Main Hackathon";
  var qrUrl = getQrUrl(qrId);
  var qrBlob = fetchQrBlob(qrId, trackName);
  var lines = [
    "Hi " + (name || "there") + ",",
    "",
    "Your registration for the " + trackName + " at " + EVENT_NAME +
      " has been received.",
    "",
    "Event date: " + EVENT_DATE,
    "Location: " + EVENT_LOCATION,
    "Check-in ID: " + qrId,
  ];

  if (data.role) lines.push("Registration role: " + formatRole(data.role));
  if (data.teamName) lines.push("Team name: " + data.teamName);
  if (data.teamCode) lines.push("Team code: " + data.teamCode);

  lines.push(
    "",
    "Your check-in QR code is attached to this email.",
    "QR code fallback link: " + qrUrl,
    "Keep this email and present the QR code at check-in.",
    "",
    "See you there,",
    "NUS Computing Club"
  );

  var detailHtml = "";
  if (data.role) {
    detailHtml += "<li><strong>Registration role:</strong> " +
      escapeHtml(formatRole(data.role)) + "</li>";
  }
  if (data.teamName) {
    detailHtml += "<li><strong>Team name:</strong> " +
      escapeHtml(data.teamName) + "</li>";
  }
  if (data.teamCode) {
    detailHtml += "<li><strong>Team code:</strong> " +
      escapeHtml(data.teamCode) + "</li>";
  }

  var htmlBody =
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">' +
      "<p>Hi " + escapeHtml(name || "there") + ",</p>" +
      "<p>Your registration for the <strong>" + escapeHtml(trackName) +
        "</strong> at <strong>" + escapeHtml(EVENT_NAME) +
        "</strong> has been received.</p>" +
      "<ul>" +
        "<li><strong>Event date:</strong> " + escapeHtml(EVENT_DATE) + "</li>" +
        "<li><strong>Location:</strong> " + escapeHtml(EVENT_LOCATION) + "</li>" +
        detailHtml +
      "</ul>" +
      '<div style="margin:24px 0;padding:20px;border:1px solid #d9c39d;' +
        'border-radius:12px;text-align:center;background:#faf8f4">' +
        '<p style="margin:0 0 12px"><strong>Your check-in QR code</strong></p>' +
        '<img src="cid:checkInQr" width="240" height="240" ' +
          'alt="LifeHack 2026 check-in QR code" />' +
        '<p style="margin:12px 0 0;font-size:12px;color:#596273">Check-in ID: ' +
          escapeHtml(qrId) + "</p>" +
      "</div>" +
      "<p>Keep this email and present the QR code at check-in. A PNG copy is " +
        "also attached in case your email client blocks inline images.</p>" +
      "<p>See you there,<br>NUS Computing Club</p>" +
    "</div>";

  MailApp.sendEmail({
    to: email,
    subject: "Your " + EVENT_NAME + " registration and check-in QR",
    body: lines.join("\n"),
    htmlBody: htmlBody,
    inlineImages: {
      checkInQr: qrBlob,
    },
    attachments: [qrBlob.copyBlob()],
    name: EVENT_NAME,
  });
}

// Algorithmic registration confirmation. The QR is intentionally not included.
function sendAlgorithmicRegistrationConfirmation(email, name) {
  var trackName = "Algorithmic Hackathon";
  var lines = [
    "Hi " + (name || "there") + ",",
    "",
    "Your registration for the " + trackName + " at " + EVENT_NAME +
      " has been received.",
    "",
    "Event date: " + EVENT_DATE,
    "Location: " + EVENT_LOCATION,
    "",
    "Your check-in QR code and final contest details will be emailed separately.",
    "",
    "See you there,",
    "NUS Computing Club",
  ];

  var htmlBody =
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">' +
      "<p>Hi " + escapeHtml(name || "there") + ",</p>" +
      "<p>Your registration for the <strong>" + trackName +
        "</strong> at <strong>" + escapeHtml(EVENT_NAME) +
        "</strong> has been received.</p>" +
      "<ul>" +
        "<li><strong>Event date:</strong> " + escapeHtml(EVENT_DATE) + "</li>" +
        "<li><strong>Location:</strong> " + escapeHtml(EVENT_LOCATION) + "</li>" +
      "</ul>" +
      "<p>Your check-in QR code and final contest details will be emailed " +
        "separately.</p>" +
      "<p>See you there,<br>NUS Computing Club</p>" +
    "</div>";

  MailApp.sendEmail({
    to: email,
    subject: EVENT_NAME + " Algorithmic Hackathon registration confirmation",
    body: lines.join("\n"),
    htmlBody: htmlBody,
    name: EVENT_NAME,
  });
}

function getQrUrl(qrId) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" +
    encodeURIComponent(qrId);
}

function fetchQrBlob(qrId, label) {
  var response = UrlFetchApp.fetch(getQrUrl(qrId), {
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      "QR image service returned HTTP " + response.getResponseCode()
    );
  }

  return response
    .getBlob()
    .setName(
      EVENT_NAME.replace(/\s+/g, "-") + "-" +
      String(label).replace(/\s+/g, "-") + "-QR.png"
    );
}

// Run once from the Apps Script editor after deploying this update. This
// requests the MailApp/UrlFetch permissions and sends a harmless test QR to the
// script owner's Google account.
function testImmediateQrEmail() {
  var ownerEmail = Session.getEffectiveUser().getEmail();
  if (!ownerEmail) {
    throw new Error("Could not determine the script owner's email address.");
  }

  sendMainRegistrationWithQr(
    ownerEmail,
    "Test Participant",
    {
      role: "solo",
      teamName: "QR delivery test",
      teamCode: "TEST-ONLY",
    },
    Utilities.getUuid()
  );

  console.log("Test QR email sent to " + maskEmail(ownerEmail));
}

// Run from the editor to verify the confirmation-only Algo email template.
function testAlgorithmicConfirmationEmail() {
  var ownerEmail = Session.getEffectiveUser().getEmail();
  if (!ownerEmail) {
    throw new Error("Could not determine the script owner's email address.");
  }

  sendAlgorithmicRegistrationConfirmation(ownerEmail, "Test Participant");
  console.log(
    "Test Algorithmic confirmation sent to " + maskEmail(ownerEmail)
  );
}

/**
 * Run manually ONCE after registration closes.
 *
 * Sends Algorithmic QR details after their confirmation-only signup. It also
 * recovers any legacy/failed Main row whose immediate QR was not marked sent.
 * CheckInEmailSent prevents repeat sends and lets the batch safely resume.
 */
function sendAllCheckInEmails() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var recipients = {};

  collectCheckInRows(
    spreadsheet.getSheetByName(MAIN_TAB),
    "Main Hackathon",
    MAIN_HEADERS,
    recipients
  );

  collectCheckInRows(
    spreadsheet.getSheetByName(ALGO_TAB),
    "Algorithmic Hackathon",
    ALGO_HEADERS,
    recipients
  );

  var emails = Object.keys(recipients);
  var sent = 0;
  var failed = 0;

  for (var i = 0; i < emails.length; i++) {
    if (MailApp.getRemainingDailyQuota() < 1) {
      console.warn(
        "Email quota exhausted. Run sendAllCheckInEmails() again after reset."
      );
      break;
    }

    var email = emails[i];
    var participant = recipients[email];

    try {
      sendCheckInEmail(email, participant.name, participant.entries);

      for (var j = 0; j < participant.rows.length; j++) {
        setCellByHeader(
          participant.rows[j].sheet,
          participant.rows[j].rowNumber,
          "CheckInEmailSent",
          true
        );

        // A recovered Main QR email also serves as its registration email.
        if (participant.rows[j].trackName === "Main Hackathon") {
          setCellByHeader(
            participant.rows[j].sheet,
            participant.rows[j].rowNumber,
            "ConfirmationEmailSent",
            true
          );
        }
      }

      sent++;
    } catch (error) {
      failed++;
      console.error(
        "Check-in email failed for " +
        maskEmail(email) + ": " + String(error)
      );
    }
  }

  console.log(
    "Check-in batch finished. Sent=" + sent +
    ", failed=" + failed +
    ", remaining quota=" + MailApp.getRemainingDailyQuota()
  );
}

function collectCheckInRows(sheet, trackName, headers, recipients) {
  if (!sheet) return;

  ensureHeaders(sheet, headers);
  var rows = getRecords(sheet);

  for (var i = 0; i < rows.length; i++) {
    var record = rows[i].record;
    var email = normalizeEmail(record.Email);

    if (!email || isTrue(record.CheckInEmailSent)) continue;

    if (!record.QR_ID) {
      record.QR_ID = Utilities.getUuid();
      setCellByHeader(sheet, rows[i].rowNumber, "QR_ID", record.QR_ID);
    }

    if (!recipients[email]) {
      recipients[email] = {
        name: record.Name || "there",
        entries: [],
        rows: [],
      };
    }

    var entry = {
      trackName: trackName,
      qrId: record.QR_ID,
    };

    if (trackName === "Main Hackathon") {
      entry.teamName = record.TeamName || "";
      entry.teamCode = record.TeamCode || "";
    }

    recipients[email].entries.push(entry);
    recipients[email].rows.push({
      sheet: sheet,
      rowNumber: rows[i].rowNumber,
      trackName: trackName,
    });
  }
}

function sendCheckInEmail(email, name, entries) {
  var lines = [
    "Hi " + (name || "there") + ",",
    "",
    "Here are your " + EVENT_NAME + " check-in details.",
    "",
    "Event date: " + EVENT_DATE,
    "Location: " + EVENT_LOCATION,
  ];

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" +
      encodeURIComponent(entry.qrId);

    lines.push(
      "",
      entry.trackName,
      "Check-in ID: " + entry.qrId,
      "QR code: " + qrUrl
    );

    if (entry.teamName) lines.push("Team name: " + entry.teamName);
    if (entry.teamCode) lines.push("Team code: " + entry.teamCode);
  }

  lines.push(
    "",
    "Keep this email and present the relevant QR code at check-in.",
    "",
    "See you there,",
    "NUS Computing Club"
  );

  MailApp.sendEmail({
    to: email,
    subject: "Your " + EVENT_NAME + " check-in details",
    body: lines.join("\n"),
    name: EVENT_NAME,
  });
}

// Retry any registration confirmations whose first send failed.
function sendMissingRegistrationConfirmations() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var configs = [
    {
      sheet: spreadsheet.getSheetByName(MAIN_TAB),
      isAlgo: false,
      headers: MAIN_HEADERS,
    },
    {
      sheet: spreadsheet.getSheetByName(ALGO_TAB),
      isAlgo: true,
      headers: ALGO_HEADERS,
    },
  ];

  var sent = 0;
  var failed = 0;

  for (var c = 0; c < configs.length; c++) {
    var config = configs[c];
    if (!config.sheet) continue;

    ensureHeaders(config.sheet, config.headers);
    var rows = getRecords(config.sheet);

    for (var i = 0; i < rows.length; i++) {
      var record = rows[i].record;
      var email = normalizeEmail(record.Email);

      if (!email || isTrue(record.ConfirmationEmailSent)) continue;

      if (MailApp.getRemainingDailyQuota() < 1) {
        console.warn("Email quota exhausted. Resume after it resets.");
        return;
      }

      try {
        if (config.isAlgo) {
          sendAlgorithmicRegistrationConfirmation(
            email,
            record.Name || "there"
          );
        } else {
          if (!record.QR_ID) {
            record.QR_ID = Utilities.getUuid();
            setCellByHeader(
              config.sheet,
              rows[i].rowNumber,
              "QR_ID",
              record.QR_ID
            );
          }

          sendMainRegistrationWithQr(
            email,
            record.Name || "there",
            {
              role: record.Role || "",
              teamName: record.TeamName || "",
              teamCode: record.TeamCode || "",
            },
            record.QR_ID
          );
        }

        setCellByHeader(
          config.sheet,
          rows[i].rowNumber,
          "ConfirmationEmailSent",
          true
        );
        if (!config.isAlgo) {
          setCellByHeader(
            config.sheet,
            rows[i].rowNumber,
            "CheckInEmailSent",
            true
          );
        }
        sent++;
      } catch (error) {
        failed++;
        console.error(
          "Confirmation retry failed for " +
          maskEmail(email) + ": " + String(error)
        );
      }
    }
  }

  console.log(
    "Confirmation retry finished. Sent=" + sent + ", failed=" + failed
  );
}

/**
 * Main-track problem-category reminder email.
 *
 * Safe workflow:
 * 1. Run previewMainReminderEmails().
 * 2. Run testMainReminderEmail().
 * 3. Only then run sendAllMainReminderEmails().
 *
 * Sent rows are marked so rerunning the function skips them.
 */
var MAIN_REMINDER_SUBJECT = "LifeHack 2026 Registration Confirmation";
var MAIN_PROBLEM_CATEGORIES = {
  "Consumerism": true,
  "Digital payments": true,
  "Sustainability": true,
};

function previewMainReminderEmails() {
  var summary = getMainReminderPreflight();
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function testMainReminderEmail() {
  var ownerEmail = Session.getEffectiveUser().getEmail();
  if (!ownerEmail) {
    throw new Error("Could not determine the Apps Script owner's email.");
  }

  sendMainReminderEmail(
    ownerEmail,
    "Test Participant",
    "TEST-TEAM-CODE",
    "Consumerism"
  );
  console.log("Test reminder sent to " + maskEmail(ownerEmail));
}

function sendAllMainReminderEmails() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(MAIN_TAB);
    if (!sheet) throw new Error("Main sheet not found.");

    ensureHeaders(sheet, MAIN_HEADERS);
    var pending = getPendingMainReminderRows(sheet);
    validateMainReminderRows(pending);

    var remainingQuota = MailApp.getRemainingDailyQuota();
    if (remainingQuota < pending.length) {
      throw new Error(
        "Not enough email quota. Pending=" + pending.length +
        ", remaining quota=" + remainingQuota +
        ". No reminder emails were sent."
      );
    }

    var sent = 0;
    var failed = 0;
    var startedAt = Date.now();

    for (var i = 0; i < pending.length; i++) {
      // Leave time for the current execution to finish cleanly. Run the same
      // function again if Apps Script stops here; sent rows will be skipped.
      if (Date.now() - startedAt > 280000) {
        console.warn(
          "Stopped safely before the execution limit. Run " +
          "sendAllMainReminderEmails again. Remaining=" + (pending.length - i)
        );
        break;
      }

      var item = pending[i];
      var record = item.record;

      try {
        sendMainReminderEmail(
          normalizeEmail(record.Email),
          String(record.Name).trim(),
          String(record.TeamCode).trim(),
          String(record.ProblemStatementID).trim()
        );
        setCellByHeader(sheet, item.rowNumber, "ReminderEmailSent", true);
        setCellByHeader(sheet, item.rowNumber, "ReminderEmailSentAt", new Date());
        setCellByHeader(sheet, item.rowNumber, "ReminderEmailError", "");
        sent++;
      } catch (error) {
        setCellByHeader(
          sheet,
          item.rowNumber,
          "ReminderEmailError",
          String(error).slice(0, 500)
        );
        failed++;
        console.error(
          "Reminder failed for " + maskEmail(record.Email) + ": " + String(error)
        );
      }
    }

    SpreadsheetApp.flush();
    console.log(
      "Main reminder run finished. Sent=" + sent + ", failed=" + failed
    );
    return { sent: sent, failed: failed };
  } finally {
    lock.releaseLock();
  }
}

function getMainReminderPreflight() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(MAIN_TAB);
  if (!sheet) throw new Error("Main sheet not found.");

  ensureHeaders(sheet, MAIN_HEADERS);
  var pending = getPendingMainReminderRows(sheet);
  validateMainReminderRows(pending);

  var categoryCounts = {
    "Consumerism": 0,
    "Digital payments": 0,
    "Sustainability": 0,
  };

  for (var i = 0; i < pending.length; i++) {
    categoryCounts[String(pending[i].record.ProblemStatementID).trim()]++;
  }

  return {
    pendingRecipients: pending.length,
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    categoryCounts: categoryCounts,
    readyToSendAllAtOnce:
      MailApp.getRemainingDailyQuota() >= pending.length,
  };
}

function getPendingMainReminderRows(sheet) {
  return getRecords(sheet).filter(function (item) {
    return !isTrue(item.record.ReminderEmailSent);
  });
}

function validateMainReminderRows(rows) {
  var seenEmails = {};
  var errors = [];

  for (var i = 0; i < rows.length; i++) {
    var rowNumber = rows[i].rowNumber;
    var record = rows[i].record;
    var name = String(record.Name || "").trim();
    var email = normalizeEmail(record.Email);
    var teamCode = String(record.TeamCode || "").trim();
    var category = String(record.ProblemStatementID || "").trim();

    if (!name) errors.push("Row " + rowNumber + ": missing Name");
    if (!email || !isValidEmail(email)) {
      errors.push("Row " + rowNumber + ": invalid Email");
    } else if (seenEmails[email]) {
      errors.push("Row " + rowNumber + ": duplicate Email");
    } else {
      seenEmails[email] = true;
    }
    if (!teamCode) errors.push("Row " + rowNumber + ": missing TeamCode");
    if (!MAIN_PROBLEM_CATEGORIES[category]) {
      errors.push(
        "Row " + rowNumber + ": invalid ProblemStatementID " + category
      );
    }
  }

  if (errors.length) {
    throw new Error(
      "Reminder preflight failed; no emails sent. " + errors.slice(0, 20).join("; ")
    );
  }
}

function sendMainReminderEmail(email, name, teamCode, category) {
  var lines = [
    "Hi " + name + ",",
    "",
    "Thank you for registering for LifeHack 2026. Your registration has been confirmed.",
    "",
    "Your team details are as follows:",
    "",
    "- Team code: " + teamCode,
    "- Problem statement category: " + category,
    "",
    "Please review the details above and let us know as soon as possible if there are any discrepancies.",
    "",
    "We look forward to seeing you at LifeHack 2026!",
    "",
    "Best regards,",
    "LifeHack 2026 Organising Committee",
  ];

  var htmlBody =
    '<div style="font-family:Arial,sans-serif;color:#17243d;line-height:1.6">' +
      "<p>Hi " + escapeHtml(name) + ",</p>" +
      "<p>Thank you for registering for LifeHack 2026. Your registration " +
        "has been confirmed.</p>" +
      "<p>Your team details are as follows:</p>" +
      "<ul>" +
        "<li><strong>Team code:</strong> " + escapeHtml(teamCode) + "</li>" +
        "<li><strong>Problem statement category:</strong> " +
          escapeHtml(category) + "</li>" +
      "</ul>" +
      "<p>Please review the details above and let us know as soon as possible " +
        "if there are any discrepancies.</p>" +
      "<p>We look forward to seeing you at LifeHack 2026!</p>" +
      "<p>Best regards,<br>LifeHack 2026 Organising Committee</p>" +
    "</div>";

  MailApp.sendEmail({
    to: email,
    subject: MAIN_REMINDER_SUBJECT,
    body: lines.join("\n"),
    htmlBody: htmlBody,
    name: EVENT_NAME,
  });
}

/**
 * Team-assignment notice for participants placed into an organizer-created
 * team. The Team Assignment tab determines which teams qualify; member names
 * and email addresses are read from the matching Main rows. One shared message
 * goes to all four members so they can use Reply All. Existing teams are never
 * included.
 *
 * Safe workflow:
 * 1. Run previewOrganizerTeamEmails().
 * 2. Run testOrganizerTeamEmail().
 * 3. Only then run sendAllOrganizerTeamEmails().
 */
var TEAM_ASSIGNMENT_TAB = "Team Assignment";
var ORGANIZER_TEAM_TYPE = "Organizer-created Solo team";
var ORGANIZER_TEAM_SUBJECT = "LifeHack 2026 Team Assignment";

function previewOrganizerTeamEmails() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var mainSheet = spreadsheet.getSheetByName(MAIN_TAB);
  if (!mainSheet) throw new Error("Main sheet not found.");

  ensureHeaders(mainSheet, MAIN_HEADERS);
  var pendingTeams = getPendingOrganizerTeamGroups(spreadsheet, mainSheet);
  var pendingRecipients = 0;
  for (var i = 0; i < pendingTeams.length; i++) {
    pendingRecipients += pendingTeams[i].members.length;
  }

  var quota = MailApp.getRemainingDailyQuota();
  var summary = {
    pendingTeams: pendingTeams.length,
    pendingRecipients: pendingRecipients,
    remainingDailyQuota: quota,
    readyToSendAllAtOnce: quota >= pendingRecipients,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function testOrganizerTeamEmail() {
  var ownerEmail = Session.getEffectiveUser().getEmail();
  if (!ownerEmail) {
    throw new Error("Could not determine the Apps Script owner's email.");
  }

  sendOrganizerTeamEmail(
    [ownerEmail],
    "TEST-TEAM-CODE",
    "Consumerism",
    [
      { name: "Member One", email: "member.one@example.com" },
      { name: "Member Two", email: "member.two@example.com" },
      { name: "Member Three", email: "member.three@example.com" },
      { name: "Member Four", email: "member.four@example.com" },
    ]
  );
  console.log("Test team-assignment email sent to " + maskEmail(ownerEmail));
}

function sendAllOrganizerTeamEmails() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var mainSheet = spreadsheet.getSheetByName(MAIN_TAB);
    if (!mainSheet) throw new Error("Main sheet not found.");

    ensureHeaders(mainSheet, MAIN_HEADERS);
    var pendingTeams = getPendingOrganizerTeamGroups(spreadsheet, mainSheet);
    var pendingRecipients = pendingTeams.reduce(function (total, team) {
      return total + team.members.length;
    }, 0);
    var quota = MailApp.getRemainingDailyQuota();
    if (quota < pendingRecipients) {
      throw new Error(
        "Not enough email quota. Pending recipients=" + pendingRecipients +
        ", remaining quota=" + quota + ". No team emails were sent."
      );
    }

    var sentTeams = 0;
    var sentRecipients = 0;
    var failedTeams = 0;

    for (var i = 0; i < pendingTeams.length; i++) {
      var team = pendingTeams[i];
      try {
        sendOrganizerTeamEmail(
          team.members.map(function (member) { return member.email; }),
          team.teamCode,
          team.category,
          team.members
        );
        var sentAt = new Date();
        for (var j = 0; j < team.members.length; j++) {
          setCellByHeader(
            mainSheet,
            team.members[j].rowNumber,
            "SoloTeamEmailSent",
            true
          );
          setCellByHeader(
            mainSheet,
            team.members[j].rowNumber,
            "SoloTeamEmailSentAt",
            sentAt
          );
          setCellByHeader(
            mainSheet,
            team.members[j].rowNumber,
            "SoloTeamEmailError",
            ""
          );
        }
        sentTeams++;
        sentRecipients += team.members.length;
      } catch (error) {
        for (var k = 0; k < team.members.length; k++) {
          setCellByHeader(
            mainSheet,
            team.members[k].rowNumber,
            "SoloTeamEmailError",
            String(error).slice(0, 500)
          );
        }
        failedTeams++;
        console.error(
          "Team email failed for " + team.teamCode + ": " + String(error)
        );
      }
    }

    SpreadsheetApp.flush();
    console.log(
      "Organizer team email run finished. Sent teams=" + sentTeams +
      ", recipients=" + sentRecipients + ", failed teams=" + failedTeams
    );
    return {
      sentTeams: sentTeams,
      sentRecipients: sentRecipients,
      failedTeams: failedTeams,
    };
  } finally {
    lock.releaseLock();
  }
}

function getPendingOrganizerTeamGroups(spreadsheet, mainSheet) {
  var assignmentSheet = spreadsheet.getSheetByName(TEAM_ASSIGNMENT_TAB);
  if (!assignmentSheet) {
    throw new Error("Team Assignment sheet not found.");
  }

  var assignments = getTeamAssignmentRecords(assignmentSheet);
  var organizerTeams = {};

  for (var i = 0; i < assignments.length; i++) {
    var assignment = assignments[i];
    if (String(assignment["Assignment Type"] || "").trim() !== ORGANIZER_TEAM_TYPE) {
      continue;
    }

    var assignedCode = String(assignment.TeamCode || "").trim();
    var assignedCategory = String(assignment.ProblemStatementID || "").trim();
    if (!assignedCode) throw new Error("Organizer-created team is missing TeamCode.");
    if (!MAIN_PROBLEM_CATEGORIES[assignedCategory]) {
      throw new Error(
        "Organizer-created team " + assignedCode +
        " has invalid ProblemStatementID: " + assignedCategory
      );
    }
    if (organizerTeams[assignedCode]) {
      throw new Error("Duplicate organizer-created TeamCode: " + assignedCode);
    }

    organizerTeams[assignedCode] = { category: assignedCategory };
  }

  var mainRows = getRecords(mainSheet);
  var membersByTeam = {};

  for (var j = 0; j < mainRows.length; j++) {
    var row = mainRows[j];
    var teamCode = String(row.record.TeamCode || "").trim();
    if (!organizerTeams[teamCode]) continue;

    if (!membersByTeam[teamCode]) membersByTeam[teamCode] = [];
    membersByTeam[teamCode].push(row);
  }

  var teamCodes = Object.keys(organizerTeams);
  var seenEmails = {};
  var pendingTeams = [];

  for (var k = 0; k < teamCodes.length; k++) {
    var code = teamCodes[k];
    var members = membersByTeam[code] || [];
    if (members.length !== 4) {
      throw new Error(
        "Organizer-created team " + code + " should have 4 Main rows; found " +
        members.length + ". No team emails were sent."
      );
    }

    var teamMembers = [];
    var sentStatuses = [];

    for (var m = 0; m < members.length; m++) {
      var memberRow = members[m];
      var memberName = String(memberRow.record.Name || "").trim();
      var memberEmail = normalizeEmail(memberRow.record.Email);
      var memberCategory = String(
        memberRow.record.ProblemStatementID || ""
      ).trim();

      if (!memberName) {
        throw new Error("Organizer-created team " + code + " has a missing Name.");
      }
      if (!memberEmail || !isValidEmail(memberEmail)) {
        throw new Error("Invalid email in organizer-created team " + code + ".");
      }
      if (seenEmails[memberEmail]) {
        throw new Error("Duplicate email in organizer-created team recipients.");
      }
      seenEmails[memberEmail] = true;
      if (memberCategory !== organizerTeams[code].category) {
        throw new Error(
          "Problem category mismatch for organizer-created team " + code + "."
        );
      }

      sentStatuses.push(isTrue(memberRow.record.SoloTeamEmailSent));
      teamMembers.push({
        rowNumber: memberRow.rowNumber,
        email: memberEmail,
        name: memberName,
      });
    }

    var sentCount = sentStatuses.filter(function (status) { return status; }).length;
    if (sentCount > 0 && sentCount < members.length) {
      throw new Error(
        "Organizer-created team " + code +
        " has mixed SoloTeamEmailSent statuses. Resolve them before sending."
      );
    }
    if (sentCount === 0) {
      pendingTeams.push({
        teamCode: code,
        category: organizerTeams[code].category,
        members: teamMembers,
      });
    }
  }

  if (teamCodes.length !== 5) {
    throw new Error(
      "Expected 5 organizer-created teams from the reviewed workbook; found " +
      teamCodes.length + ". No team emails were sent."
    );
  }

  return pendingTeams;
}

function getTeamAssignmentRecords(sheet) {
  var values = sheet.getDataRange().getDisplayValues();
  var headerRowIndex = -1;

  for (var i = 0; i < values.length; i++) {
    if (
      values[i].indexOf("TeamCode") !== -1 &&
      values[i].indexOf("Assignment Type") !== -1 &&
      values[i].indexOf("ProblemStatementID") !== -1
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("Could not find headers in Team Assignment sheet.");
  }

  var headers = values[headerRowIndex].map(function (value) {
    return String(value).trim();
  });
  var records = [];

  for (var rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex++) {
    var record = {};
    var hasValue = false;

    for (var columnIndex = 0; columnIndex < headers.length; columnIndex++) {
      if (!headers[columnIndex]) continue;
      record[headers[columnIndex]] = values[rowIndex][columnIndex];
      if (values[rowIndex][columnIndex]) hasValue = true;
    }

    if (hasValue) records.push(record);
  }

  return records;
}

function sendOrganizerTeamEmail(recipientEmails, teamCode, category, members) {
  var memberLines = members.map(function (member) {
    return "  - " + member.name + " (" + member.email + ")";
  });
  var lines = [
    "Hi team,",
    "",
    "As you registered without a pre-formed team, the organising committee has assigned you to a team.",
    "",
    "Your team details are:",
    "",
    "- Team code: " + teamCode,
    "- Problem statement category: " + category,
    "- Team members:",
  ].concat(memberLines).concat([
    "",
    "You may use Reply All to contact your teammates.",
    "",
    "Please review the details above and let us know as soon as possible if there are any discrepancies.",
    "",
    "We look forward to seeing you at LifeHack 2026!",
    "",
    "Best regards,",
    "LifeHack 2026 Organising Committee",
  ]);

  var memberItems = members.map(function (member) {
    return "<li>" + escapeHtml(member.name) + " (" +
      '<a href="mailto:' + escapeHtml(member.email) + '">' +
      escapeHtml(member.email) + "</a>)</li>";
  }).join("");
  var htmlBody =
    '<div style="font-family:Arial,sans-serif;color:#17243d;line-height:1.6">' +
      "<p>Hi team,</p>" +
      "<p>As you registered without a pre-formed team, the organising " +
        "committee has assigned you to a team.</p>" +
      "<p>Your team details are:</p>" +
      "<ul>" +
        "<li><strong>Team code:</strong> " + escapeHtml(teamCode) + "</li>" +
        "<li><strong>Problem statement category:</strong> " +
          escapeHtml(category) + "</li>" +
        "<li><strong>Team members:</strong><ul>" + memberItems + "</ul></li>" +
      "</ul>" +
      "<p>You may use <strong>Reply All</strong> to contact your teammates.</p>" +
      "<p>Please review the details above and let us know as soon as possible " +
        "if there are any discrepancies.</p>" +
      "<p>We look forward to seeing you at LifeHack 2026!</p>" +
      "<p>Best regards,<br>LifeHack 2026 Organising Committee</p>" +
    "</div>";

  MailApp.sendEmail({
    to: recipientEmails.join(","),
    subject: ORGANIZER_TEAM_SUBJECT,
    body: lines.join("\n"),
    htmlBody: htmlBody,
    name: EVENT_NAME,
  });
}

// Run before bulk check-in to find duplicates that existed before enforcement.
function auditDuplicateEmails() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  auditSheetDuplicates(spreadsheet.getSheetByName(MAIN_TAB), MAIN_TAB);
  auditSheetDuplicates(spreadsheet.getSheetByName(ALGO_TAB), ALGO_TAB);
}

function auditSheetDuplicates(sheet, label) {
  if (!sheet) return;

  var rows = getRecords(sheet);
  var counts = {};

  for (var i = 0; i < rows.length; i++) {
    var email = normalizeEmail(rows[i].record.Email);
    if (email) counts[email] = (counts[email] || 0) + 1;
  }

  var duplicates = Object.keys(counts).filter(function (email) {
    return counts[email] > 1;
  });

  if (!duplicates.length) {
    console.log(label + ": no duplicate emails.");
    return;
  }

  console.warn(
    label + " duplicates: " +
    duplicates.map(function (email) {
      return maskEmail(email) + " (" + counts[email] + ")";
    }).join(", ")
  );
}

// Sheet setup and migration.
function setupSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ensureTab(spreadsheet, MAIN_TAB, MAIN_HEADERS);
  ensureTab(spreadsheet, ALGO_TAB, ALGO_HEADERS);
}

function ensureTab(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  ensureHeaders(sheet, headers);
}

function ensureHeaders(sheet, requiredHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }

  var existing = getHeaders(sheet);
  var lastColumn = existing.length;

  for (var i = 0; i < requiredHeaders.length; i++) {
    if (existing.indexOf(requiredHeaders[i]) === -1) {
      lastColumn++;
      sheet.getRange(1, lastColumn).setValue(requiredHeaders[i]);
      existing.push(requiredHeaders[i]);
    }
  }

  sheet.getRange(1, 1, 1, lastColumn).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function appendRecord(sheet, record) {
  var headers = getHeaders(sheet);
  var values = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header)
      ? record[header]
      : "";
  });

  sheet.appendRow(values);
  return sheet.getLastRow();
}

function getRecords(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = getHeaders(sheet);
  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();

  return values.map(function (row, index) {
    var record = {};

    for (var i = 0; i < headers.length; i++) {
      record[headers[i]] = row[i];
    }

    return {
      rowNumber: index + 2,
      record: record,
    };
  });
}

function getHeaders(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];

  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function (value) {
      return String(value).trim();
    });
}

function findEmailRegistration(sheet, email) {
  var rows = getRecords(sheet);

  for (var i = 0; i < rows.length; i++) {
    if (normalizeEmail(rows[i].record.Email) === email) {
      return rows[i];
    }
  }

  return null;
}

function setCellByHeader(sheet, rowNumber, header, value) {
  var column = getHeaderColumn(sheet, header);
  if (!column) throw new Error("Missing sheet column: " + header);
  sheet.getRange(rowNumber, column).setValue(value);
}

function getHeaderColumn(sheet, header) {
  var index = getHeaders(sheet).indexOf(header);
  return index === -1 ? 0 : index + 1;
}

// General helpers.
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isNusEmail(email) {
  return email.slice(-NUS_DOMAIN.length) === NUS_DOMAIN;
}

function isTrue(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function formatRole(role) {
  var value = String(role || "");
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function maskEmail(email) {
  var parts = String(email || "").split("@");
  if (parts.length !== 2) return "[invalid email]";

  var local = parts[0];
  var visible = local.length <= 2 ? local.charAt(0) : local.slice(0, 2);
  return visible + "***@" + parts[1];
}

function jsonOut(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * LifeHack judging portal.
 *
 * The portal is served by Apps Script at ?page=judge. Judge credentials are
 * read from the "Judge Allotment" tab. Scores are stored in "Judging Results".
 * A judge's category is derived from the sponsor/problem statement in the
 * allotment sheet and is checked again on every score submission.
 */
var JUDGE_TAB = "Judge Allotment";
var JUDGING_RESULTS_TAB = "Judging Results";
var JUDGE_SESSION_SECONDS = 21600;
var JUDGE_MAX_LOGIN_ATTEMPTS = 8;
var JUDGE_SCORE_MAX = 100;
var JUDGE_PROBLEM_TO_CATEGORY = {
  "rezolve ai": "Consumerism",
  "visa": "Digital payments",
  "ecovolt": "Sustainability",
  "consumerism": "Consumerism",
  "digital payments": "Digital payments",
  "sustainability": "Sustainability",
};
var JUDGING_RESULTS_HEADERS = [
  "SubmittedAt", "UpdatedAt", "JudgeUsername", "JudgeName", "JudgeType",
  "ProblemStatement", "Category", "TeamCode", "TeamName",
  "OverallScore", "Comments",
];

function setupJudgingPortal() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var judgeSheet = spreadsheet.getSheetByName(JUDGE_TAB);
  if (!judgeSheet) {
    throw new Error(
      'Create a tab named "' + JUDGE_TAB +
      '" and paste the judge allotment table into it first.'
    );
  }

  var judges = getJudgeAccounts_(judgeSheet);
  if (!judges.length) throw new Error("No judge accounts were found.");

  var usernames = {};
  for (var i = 0; i < judges.length; i++) {
    if (!judges[i].username || !judges[i].password) {
      throw new Error("Every judge must have a Username and Password.");
    }
    if (usernames[judges[i].username]) {
      throw new Error("Duplicate judge username: " + judges[i].username);
    }
    usernames[judges[i].username] = true;
    getJudgeCategory_(judges[i].problemStatement);
  }

  var resultsSheet = spreadsheet.getSheetByName(JUDGING_RESULTS_TAB);
  if (!resultsSheet) resultsSheet = spreadsheet.insertSheet(JUDGING_RESULTS_TAB);
  ensureHeaders(resultsSheet, JUDGING_RESULTS_HEADERS);
  resultsSheet.setFrozenRows(1);
  resultsSheet.getRange(1, 1, 1, JUDGING_RESULTS_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#17243d")
    .setFontColor("#ffffff");

  var preview = previewJudgingPortal();
  console.log(JSON.stringify(preview, null, 2));
  return preview;
}

function previewJudgingPortal() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var judgeSheet = spreadsheet.getSheetByName(JUDGE_TAB);
  var mainSheet = spreadsheet.getSheetByName(MAIN_TAB);
  if (!judgeSheet) throw new Error('Missing tab: "' + JUDGE_TAB + '".');
  if (!mainSheet) throw new Error('Missing tab: "' + MAIN_TAB + '".');

  var judges = getJudgeAccounts_(judgeSheet);
  var teams = getJudgingTeams_(mainSheet);
  var summary = {
    judges: judges.length,
    judgesByCategory: emptyCategoryCounts_(),
    teams: teams.length,
    teamsByCategory: emptyCategoryCounts_(),
  };

  for (var i = 0; i < judges.length; i++) {
    summary.judgesByCategory[getJudgeCategory_(judges[i].problemStatement)]++;
  }
  for (var j = 0; j < teams.length; j++) {
    summary.teamsByCategory[teams[j].category]++;
  }

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function judgeLogin(username, password) {
  var normalizedUsername = normalizeJudgeUsername_(username);
  var suppliedPassword = String(password || "");
  if (!normalizedUsername || !suppliedPassword) {
    throw new Error("Enter your username and password.");
  }

  var cache = CacheService.getScriptCache();
  var attemptKey = "judge_attempt_" + digestText_(normalizedUsername);
  var attempts = Number(cache.get(attemptKey) || 0);
  if (attempts >= JUDGE_MAX_LOGIN_ATTEMPTS) {
    throw new Error("Too many login attempts. Please wait 10 minutes.");
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var judgeSheet = spreadsheet.getSheetByName(JUDGE_TAB);
  if (!judgeSheet) throw new Error("Judging has not been set up yet.");
  var judges = getJudgeAccounts_(judgeSheet);
  var judge = null;

  for (var i = 0; i < judges.length; i++) {
    if (
      judges[i].username === normalizedUsername &&
      judges[i].password === suppliedPassword &&
      judges[i].active
    ) {
      judge = judges[i];
      break;
    }
  }

  if (!judge) {
    cache.put(attemptKey, String(attempts + 1), 600);
    Utilities.sleep(350);
    throw new Error("Incorrect username or password.");
  }

  cache.remove(attemptKey);
  var category = getJudgeCategory_(judge.problemStatement);
  var token = Utilities.getUuid();
  var session = {
    username: judge.username,
    judgeName: judge.judgeName,
    judgeType: judge.judgeType,
    problemStatement: judge.problemStatement,
    category: category,
  };
  cache.put("judge_session_" + token, JSON.stringify(session), JUDGE_SESSION_SECONDS);

  return buildJudgePortalData_(token, session);
}

function judgeRefresh(token) {
  return buildJudgePortalData_(token, getJudgeSession_(token));
}

function judgeLogout(token) {
  var cleanToken = String(token || "").trim();
  if (cleanToken) CacheService.getScriptCache().remove("judge_session_" + cleanToken);
  return { ok: true };
}

function judgeSaveScore(token, submission) {
  var session = getJudgeSession_(token);
  var data = submission || {};
  var requestedCode = normalizeTeamCode_(data.teamCode);
  var score = Number(data.overallScore);
  var comments = String(data.comments || "").trim();

  if (!requestedCode) throw new Error("Team code is required.");
  if (!isFinite(score) || score < 0 || score > JUDGE_SCORE_MAX) {
    throw new Error("Overall score must be between 0 and " + JUDGE_SCORE_MAX + ".");
  }
  if (comments.length > 2000) {
    throw new Error("Comments must be 2,000 characters or fewer.");
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var mainSheet = spreadsheet.getSheetByName(MAIN_TAB);
  if (!mainSheet) throw new Error("Main sheet not found.");
  var teams = getJudgingTeams_(mainSheet);
  var team = null;

  for (var i = 0; i < teams.length; i++) {
    if (
      normalizeTeamCode_(teams[i].teamCode) === requestedCode &&
      teams[i].category === session.category
    ) {
      team = teams[i];
      break;
    }
  }
  if (!team) throw new Error("This team is not assigned to your category.");

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var resultsSheet = spreadsheet.getSheetByName(JUDGING_RESULTS_TAB);
    if (!resultsSheet) {
      resultsSheet = spreadsheet.insertSheet(JUDGING_RESULTS_TAB);
    }
    ensureHeaders(resultsSheet, JUDGING_RESULTS_HEADERS);

    var results = getRecords(resultsSheet);
    var existing = null;
    for (var j = 0; j < results.length; j++) {
      if (
        normalizeJudgeUsername_(results[j].record.JudgeUsername) === session.username &&
        normalizeTeamCode_(results[j].record.TeamCode) === requestedCode
      ) {
        existing = results[j];
        break;
      }
    }

    var now = new Date();
    var record = {
      SubmittedAt: existing ? existing.record.SubmittedAt : now,
      UpdatedAt: now,
      JudgeUsername: session.username,
      JudgeName: session.judgeName,
      JudgeType: session.judgeType,
      ProblemStatement: session.problemStatement,
      Category: session.category,
      TeamCode: team.teamCode,
      TeamName: team.teamName,
      OverallScore: Math.round(score * 100) / 100,
      Comments: comments,
    };

    if (existing) {
      var headers = getHeaders(resultsSheet);
      var rowValues = headers.map(function (header) {
        return Object.prototype.hasOwnProperty.call(record, header)
          ? record[header]
          : existing.record[header];
      });
      resultsSheet.getRange(existing.rowNumber, 1, 1, headers.length)
        .setValues([rowValues]);
    } else {
      appendRecord(resultsSheet, record);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return {
    ok: true,
    teamCode: team.teamCode,
    overallScore: Math.round(score * 100) / 100,
    comments: comments,
    updatedAt: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss"
    ),
  };
}

function buildJudgePortalData_(token, session) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var mainSheet = spreadsheet.getSheetByName(MAIN_TAB);
  if (!mainSheet) throw new Error("Main sheet not found.");

  var allTeams = getJudgingTeams_(mainSheet);
  var teams = allTeams.filter(function (team) {
    return team.category === session.category;
  });
  var savedScores = getJudgeSavedScores_(spreadsheet, session.username);

  return {
    ok: true,
    token: token,
    judge: {
      name: session.judgeName,
      type: session.judgeType,
      problemStatement: session.problemStatement,
      category: session.category,
    },
    scoreMaximum: JUDGE_SCORE_MAX,
    teams: teams.map(function (team) {
      var saved = savedScores[normalizeTeamCode_(team.teamCode)] || null;
      return {
        teamCode: team.teamCode,
        teamName: team.teamName,
        members: team.members,
        saved: saved,
      };
    }),
  };
}

function getJudgeSession_(token) {
  var cleanToken = String(token || "").trim();
  if (!/^[a-f0-9-]{30,50}$/i.test(cleanToken)) {
    throw new Error("Your judging session has expired. Please log in again.");
  }
  var cache = CacheService.getScriptCache();
  var key = "judge_session_" + cleanToken;
  var serialized = cache.get(key);
  if (!serialized) {
    throw new Error("Your judging session has expired. Please log in again.");
  }
  cache.put(key, serialized, JUDGE_SESSION_SECONDS);
  return JSON.parse(serialized);
}

function getJudgeAccounts_(sheet) {
  var table = readTableWithHeader_(sheet, ["Username", "Password"]);
  var judges = [];
  for (var i = 0; i < table.records.length; i++) {
    var record = table.records[i].record;
    var username = normalizeJudgeUsername_(record.Username);
    var password = String(record.Password || "").trim();
    if (!username && !password) continue;
    judges.push({
      problemStatement: String(record["Problem Statement"] || "").trim(),
      judgeType: String(record["Judge Type"] || "").trim(),
      judgeName: String(record["Judge Name"] || "").trim(),
      username: username,
      password: password,
      active: !Object.prototype.hasOwnProperty.call(record, "Active") ||
        String(record.Active || "").trim() === "" || isTrue(record.Active),
    });
  }
  return judges;
}

function getJudgeCategory_(problemStatement) {
  var key = String(problemStatement || "").trim().toLowerCase();
  var category = JUDGE_PROBLEM_TO_CATEGORY[key];
  if (!category) {
    throw new Error(
      "No judging-category mapping exists for problem statement: " +
      String(problemStatement || "[blank]")
    );
  }
  return category;
}

function getJudgingTeams_(mainSheet) {
  var rows = getRecords(mainSheet);
  var teamsByCode = {};

  for (var i = 0; i < rows.length; i++) {
    var record = rows[i].record;
    var displayCode = String(record.TeamCode || "").trim();
    var codeKey = normalizeTeamCode_(displayCode);
    var category = String(record.ProblemStatementID || "").trim();
    if (!codeKey || !MAIN_PROBLEM_CATEGORIES[category]) continue;

    if (!teamsByCode[codeKey]) {
      teamsByCode[codeKey] = {
        teamCode: displayCode,
        teamName: "",
        category: category,
        members: [],
      };
    }
    var team = teamsByCode[codeKey];
    if (team.category !== category) {
      throw new Error("Category mismatch inside team " + displayCode + ".");
    }
    var teamName = String(record.TeamName || "").trim();
    if (teamName && !team.teamName) team.teamName = teamName;
    var memberName = String(record.Name || "").trim();
    if (memberName && team.members.indexOf(memberName) === -1) {
      team.members.push(memberName);
    }
  }

  return Object.keys(teamsByCode).map(function (key) {
    return teamsByCode[key];
  }).sort(function (a, b) {
    return a.teamCode.localeCompare(b.teamCode);
  });
}

function getJudgeSavedScores_(spreadsheet, username) {
  var saved = {};
  var resultsSheet = spreadsheet.getSheetByName(JUDGING_RESULTS_TAB);
  if (!resultsSheet || resultsSheet.getLastRow() < 2) return saved;
  var results = getRecords(resultsSheet);

  for (var i = 0; i < results.length; i++) {
    var record = results[i].record;
    if (normalizeJudgeUsername_(record.JudgeUsername) !== username) continue;
    saved[normalizeTeamCode_(record.TeamCode)] = {
      overallScore: Number(record.OverallScore),
      comments: String(record.Comments || ""),
      updatedAt: formatSheetDate_(record.UpdatedAt),
    };
  }
  return saved;
}

function readTableWithHeader_(sheet, requiredHeaders) {
  var values = sheet.getDataRange().getDisplayValues();
  var headerRowIndex = -1;
  for (var i = 0; i < values.length; i++) {
    var hasAllHeaders = requiredHeaders.every(function (header) {
      return values[i].indexOf(header) !== -1;
    });
    if (hasAllHeaders) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) {
    throw new Error(
      'Could not find these headers in "' + sheet.getName() + '": ' +
      requiredHeaders.join(", ")
    );
  }

  var headers = values[headerRowIndex].map(function (value) {
    return String(value).trim();
  });
  var records = [];
  for (var rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex++) {
    var record = {};
    var hasValue = false;
    for (var columnIndex = 0; columnIndex < headers.length; columnIndex++) {
      if (!headers[columnIndex]) continue;
      record[headers[columnIndex]] = values[rowIndex][columnIndex];
      if (values[rowIndex][columnIndex]) hasValue = true;
    }
    if (hasValue) records.push({ rowNumber: rowIndex + 1, record: record });
  }
  return { headerRowNumber: headerRowIndex + 1, records: records };
}

function emptyCategoryCounts_() {
  return { "Consumerism": 0, "Digital payments": 0, "Sustainability": 0 };
}

function normalizeJudgeUsername_(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTeamCode_(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function digestText_(value) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ""),
    Utilities.Charset.UTF_8
  );
  return digest.map(function (byte) {
    var normalized = byte < 0 ? byte + 256 : byte;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("").slice(0, 24);
}

function formatSheetDate_(value) {
  if (!value) return "";
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}
