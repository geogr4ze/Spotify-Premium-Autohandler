/**
 * Safe manual preview for the Apps Script editor.
 * Reads the tracker but does not send mail, import Gmail, mark mail read,
 * or modify the spreadsheet, even if the project is set to PRODUCTION.
 */
/**
 * Force a read-only reminder preview.
 * @returns {Object} Payment cycle report.
 * @effects Reads tracker and logs previews; no Gmail import, writes or mail.
 */
function previewPaymentReminders() {
  return runPaymentCycle(undefined, true);
}

/**
 * Inspect recalculated paid-through dates in the Apps Script editor.
 * Intentionally read-only regardless of EMAIL_MODE: no Gmail operations,
 * email sending, or writes to Tracker rows 7 and 8.
 */
/**
 * Calculate coverage without saving.
 * @returns {Object[]} Participant coverage summary.
 * @effects Reads sheet and logs results only.
 */
function testUpdateParticipants() {
  const context = getTrackerContext();
  const report = updateParticipants(context, false);
  const summary = report.participants.map(person => ({
    name: person.name,
    totalPaid: moneyString(parseMoneyCents(person.amountPaid)),
    calculatedEndDate: person.endDate,
    prepaidCredit: moneyString(person.creditCents),
    monthsPaid: person.monthsPaid
  }));

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * Manually apply recalculated tracker values in a DEV dry run.
 * This updates only Tracker rows 7 and 8. It never reads Gmail or sends mail.
 * Zero cumulative payments are valid on the test sheet, even if this
 * overwrites previously saved end dates and credits.
 */
/**
 * Apply coverage calculations in an explicitly configured DEV dry run.
 * @requires DRY_RUN, production email disabled and nonempty participant list.
 * @returns {Object[]} Updated coverage summary.
 * @effects Writes Tracker rows 7 and 8; no Gmail or delivery.
 * @throws {Error} Invalid mode, missing participants or data error.
 */
function updateTrackerValues() {
  const properties = getScriptSettings();
  const mode = properties.getProperty('EMAIL_MODE') || 'DRY_RUN';
  if (mode !== 'DRY_RUN' ||
      properties.getProperty('ALLOW_PRODUCTION_EMAILS') === 'true') {
    throw new Error('Manual tracker updates require EMAIL_MODE=DRY_RUN and ALLOW_PRODUCTION_EMAILS=false.');
  }

  const context = getTrackerContext();
  const preview = updateParticipants(context, false);
  if (!preview.participants.length) {
    throw new Error('No participants found; nothing was updated.');
  }
  const report = updateParticipants(context, true);
  const summary = report.participants.map(person => ({
    name: person.name,
    totalPaid: moneyString(parseMoneyCents(person.amountPaid)),
    endMonth: previousCalendarDay(person.endDate),
    nextBillingDate: person.endDate,
    prepaidCredit: moneyString(person.creditCents)
  }));
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}


/**
 * Explicit one-time Gmail payment import for a controlled live-data review.
 *
 * Writes recognized, unimported messages into the Emails tab and marks them
 * read, but does NOT update Tracker end dates or send reminder emails.
 * Review the Gmail label and historical rows before running this function.
 */
/**
 * Run an explicitly enabled import without recomputing coverage or sending reminders.
 * @requires DRY_RUN, production email disabled and import enabled.
 * @returns {Object} Import counts.
 * @effects Writes recognized records, marks messages read and logs results.
 * @throws {Error} Invalid review configuration.
 */
function importPaymentsForReview() {
  const properties = getScriptSettings();
  const mode = (properties.getProperty('EMAIL_MODE') || 'DRY_RUN')
    .trim().toUpperCase();
  if (mode !== 'DRY_RUN' ||
      properties.getProperty('ALLOW_PRODUCTION_EMAILS') === 'true' ||
      properties.getProperty('ENABLE_PAYMENT_IMPORT') !== 'true') {
    throw new Error(
      'Import review requires EMAIL_MODE=DRY_RUN, ' +
      'ALLOW_PRODUCTION_EMAILS=false, and ENABLE_PAYMENT_IMPORT=true.'
    );
  }

  const context = getTrackerContext();
  const result = addData(context);
  SpreadsheetApp.flush();
  console.log(JSON.stringify(result, null, 2));
  return result;
}
