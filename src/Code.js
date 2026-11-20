/**
 * Safe manual preview for the Apps Script editor.
 * Reads the tracker but does not send mail, import Gmail, mark mail read,
 * or modify the spreadsheet, even if the project is set to PRODUCTION.
 */
function previewPaymentReminders() {
  return runPaymentCycle(undefined, true);
}

/**
 * Inspect recalculated paid-through dates in the Apps Script editor.
 * Intentionally read-only regardless of EMAIL_MODE: no Gmail operations,
 * email sending, or writes to Tracker rows 7 and 8.
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
 * Refuse to replace previously saved coverage when payment history is missing.
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
  if (!preview.participants.some(person => parseMoneyCents(person.amountPaid) > 0)) {
    throw new Error('All cumulative payment totals are $0.00. Add DEV payment records before updating end dates.');
  }

  for (const person of preview.participants) {
    const savedDate = dateKey(person.savedEndDate, context.timezone);
    if (parseMoneyCents(person.amountPaid) === 0 &&
        savedDate && savedDate >= person.endDate) {
      throw new Error(
        'Missing payment history for ' + person.name +
        '; existing end month would be overwritten. Nothing was updated.'
      );
    }
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
