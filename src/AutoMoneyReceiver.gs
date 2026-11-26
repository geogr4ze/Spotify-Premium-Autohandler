/**
 * Extract only unambiguous Interac-style notifications from subject lines.
 * Unknown formats remain unread for manual review — never guess a payment.
 */
/**
 * Extract a recognized received-payment subject without guessing.
 * @param {string} subject - Original subject.
 * @returns {{name:string,amount:number}
 * null} Name and positive dollar amount or null.
 */
function parsePaymentSubject(subject) {
  if (typeof subject !== 'string' || !/\breceived\b/i.test(subject)) return null;
  const nameMatch = /\bfrom\s+(.+?)\s+and\b/i.exec(subject);
  const amountMatch = /\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/.exec(subject);
  if (!nameMatch || !amountMatch) return null;
  const name = nameMatch[1].trim();
  if (!name || name.length > 150) return null;
  try {
    const cents = parseMoneyCents(amountMatch[0]);
    if (cents <= 0) return null;
    return { name, amount: cents / 100 };
  } catch (error) {
    return null;
  }
}

/** Import Gmail notifications only in explicitly enabled production mode. */
/**
 * Import unread labelled payment emails and deduplicate by message ID.
 * @param {Object} context - Tracker context with emailSheet.
 * @requires ENABLE_PAYMENT_IMPORT=true for actual import; caller controls mode.
 * @returns {Object} Imported/skipped counts and optional disabled/missingLabel flags.
 * @effects Inserts recognized rows and marks messages read after persistence; unknown subjects stay unread.
 */
function addData(context) {
  if (getScriptSettings().getProperty('ENABLE_PAYMENT_IMPORT') !== 'true') {
    return { imported: 0, skipped: 0, disabled: true };
  }

  const label = GmailApp.getUserLabelByName(TRACKER_LAYOUT.paymentLabel);
  if (!label) {
    console.warn('Payment label not found; skipping inbox import.');
    return { imported: 0, skipped: 0, missingLabel: true };
  }
  const sheet = context.emailSheet;
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1
    ? sheet.getRange(2, 5, lastRow - 1, 1).getValues().map(row => String(row[0]))
    : [];
  const seenIds = new Set(ids);
  let imported = 0;
  let skipped = 0;

  // The labelled inbox is small; processing all threads also handles multi-message threads.
  for (const thread of label.getThreads()) {
    for (const message of thread.getMessages()) {
      if (!message.isUnread()) continue;
      const messageId = String(message.getId());
      if (seenIds.has(messageId)) {
        message.markRead(); // Imported previously, e.g. a prior run failed after insert.
        continue;
      }
      const parsed = parsePaymentSubject(message.getSubject());
      if (!parsed) {
        skipped++;
        console.warn('Unrecognized payment notification; left unread for review.');
        continue;
      }
      const when = message.getDate();
      if (Object.prototype.toString.call(when) !== '[object Date]' ||
          !Number.isFinite(when.getTime())) {
        skipped++;
        continue;
      }
      sheet.insertRows(2, 1);
      sheet.getRange(2, 1, 1, 5).setValues([[
        message.getSubject(), when, parsed.name, parsed.amount, messageId
      ]]);
      SpreadsheetApp.flush();
      seenIds.add(messageId);
      imported++;
      message.markRead(); // Only after the spreadsheet write succeeds.
    }
  }
  return { imported, skipped };
}
