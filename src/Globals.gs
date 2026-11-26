/** Sheet layout used by the existing Spotify tracker. */
const TRACKER_LAYOUT = Object.freeze({
  firstColumn: 2, // B
  lastColumn: 6,  // F — five paying participants
  joinDateRow: 4,
  nameRow: 5,
  paidRow: 6,
  endDateRow: 7,
  creditRow: 8,
  emailRow: 9,
  rateStartRow: 16,
  paymentLabel: 'Spotify Premium Money'
});

/**
 * Access private script properties.
 * @returns {GoogleAppsScript.Properties.Properties} Property store; does not modify it.
 */
function getScriptSettings() {
  return PropertiesService.getScriptProperties();
}

/** Load the configured spreadsheet only when a function is actually run. */
/**
 * Open configured spreadsheet and locate required tabs.
 * @returns {Object} Spreadsheet, Tracker, Emails and timezone.
 * @throws {Error} Missing ID/tab or access failure.
 */
function getTrackerContext() {
  const spreadsheetId = getScriptSettings().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('Missing SPREADSHEET_ID in Apps Script project settings.');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const trackerSheet = spreadsheet.getSheetByName('Tracker');
  const emailSheet = spreadsheet.getSheetByName('Emails');
  if (!trackerSheet || !emailSheet) {
    throw new Error('The spreadsheet must contain Tracker and Emails sheets.');
  }
  return {
    spreadsheet,
    trackerSheet,
    emailSheet,
    timezone: spreadsheet.getSpreadsheetTimeZone()
  };
}

/** No personal addresses or spreadsheet IDs are committed to GitHub. */
/**
 * Read the private owner address.
 * @returns {string} Trimmed address.
 * @throws {Error} Missing or invalid address.
 */
function getOwnerEmail() {
  const email = (getScriptSettings().getProperty('OWNER_EMAIL') || '').trim();
  if (!isValidEmailAddress(email)) {
    throw new Error('Set OWNER_EMAIL to your own email address in script properties.');
  }
  return email;
}

/**
 * Check basic address syntax, not mailbox existence.
 * @param {*} address - Candidate.
 * @returns {boolean} Whether string matches email pattern.
 */
function isValidEmailAddress(address) {
  return typeof address === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim());
}

/** Read the five participant records fresh each time; never cache sheet values. */
/**
 * Read current participant columns, omitting wholly empty ones.
 * @param {Object} context - Tracker context.
 * @returns {Object[]} Records with column, join date, payments, coverage and email.
 * @effects Reads only.
 */
function readParticipantRecords(context) {
  const width = TRACKER_LAYOUT.lastColumn - TRACKER_LAYOUT.firstColumn + 1;
  const joins = context.trackerSheet.getRange(4, 2, 1, width).getValues()[0];
  const rows = context.trackerSheet.getRange(5, 2, 5, width).getValues();
  const participants = [];

  for (let i = 0; i < width; i++) {
    // A wholly empty column is not an active participant.
    if (!rows[0][i] && !rows[4][i] && !joins[i]) continue;
    participants.push({
      column: TRACKER_LAYOUT.firstColumn + i,
      joinDate: joins[i],
      name: String(rows[0][i] || '').trim(),
      amountPaid: rows[1][i],
      savedEndDate: rows[2][i],
      savedCredit: rows[3][i],
      email: String(rows[4][i] || '').trim()
    });
  }
  return participants;
}
