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
var EVENT_DATE = "22–23 August 2026";
var EVENT_LOCATION = "NUS School of Computing";

var MAIN_HEADERS = [
  "Timestamp", "Name", "Email", "University", "Type",
  "Nationality", "FieldOfStudy", "YearOfStudy",
  "Role", "TeamCode", "TeamName", "Skills",
  "QR_ID", "CheckedIn", "ConfirmationEmailSent", "CheckInEmailSent",
];

var ALGO_HEADERS = [
  "Timestamp", "Name", "Email", "University", "Type",
  "Nationality", "FieldOfStudy", "YearOfStudy",
  "Codeforces", "WarmupLevel",
  "QR_ID", "CheckedIn", "ConfirmationEmailSent", "CheckInEmailSent",
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

function doGet() {
  return jsonOut({
    ok: true,
    service: EVENT_NAME + " registration",
    workflow: "main-immediate-qr-algo-confirmation-v3",
  });
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
