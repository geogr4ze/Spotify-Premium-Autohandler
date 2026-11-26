/** Read any dated rates starting at row 16, including rates added in the future. */
/**
 * Read and sort dated monthly prices from the rate table.
 * @param {Object} context - Tracker and timezone.
 * @returns {Object[]} Rates with startDate and cents in ascending date order.
 * @throws {Error} Empty, invalid, nonpositive or duplicate rates.
 */
function readRateSchedule(context) {
  const sheet = context.trackerSheet;
  const firstRow = TRACKER_LAYOUT.rateStartRow;
  const rowCount = Math.max(2, sheet.getLastRow() - firstRow + 1);
  const rows = sheet.getRange(firstRow, 1, rowCount, 3).getValues();
  const rates = [];
  for (const row of rows) {
    // A blank row ends the rate table; ignore any unrelated data below it.
    if (!row[0] && !row[2]) break;
    const startDate = dateKey(row[0], context.timezone);
    if (!startDate) continue; // Ignore unrelated content below the rate table.
    const cents = parseMoneyCents(row[2]);
    if (cents <= 0) throw new Error('Monthly rates must be greater than zero.');
    rates.push({ startDate, cents });
  }
  if (!rates.length) {
    throw new Error('No dated monthly rates found in Tracker columns A and C from row 16.');
  }
  rates.sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let i = 1; i < rates.length; i++) {
    if (rates[i].startDate === rates[i - 1].startDate) {
      throw new Error('Two rates have the same effective date: ' + rates[i].startDate);
    }
  }
  return rates;
}

/** Convert the next billing date into the sheet's inclusive end month. */
/**
 * Convert an exclusive billing boundary into the preceding calendar day.
 * @param {string} key - Valid yyyy-MM-dd.
 * @returns {string} Previous date key.
 */
function previousCalendarDay(key) {
  const parts = key.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - 1))
    .toISOString().slice(0, 10);
}

/**
 * Calculate each participant from their join date and total contributions.
 * Only explicit, approved write paths should pass writeChanges=true.
 */
/**
 * Calculate coverage for every participant before optionally writing results.
 * @param {Object} context - Tracker context.
 * @param {boolean} writeChanges - Only true allows writes.
 * @returns {Object} Participant results and rates.
 * @effects When true, writes coverage and credit and flushes Sheets.
 * @throws {Error} Invalid participant or payment data.
 */
function updateParticipants(context, writeChanges) {
  const records = readParticipantRecords(context);
  const rates = readRateSchedule(context);
  const results = [];

  // Validate all records before writing a single cell.
  for (const record of records) {
    const joined = dateKey(record.joinDate, context.timezone);
    if (!joined || !record.name || !isValidEmailAddress(record.email)) {
      throw new Error('Invalid participant data in Tracker column ' + record.column);
    }
    const result = calculateCoverage(joined, parseMoneyCents(record.amountPaid), rates);
    results.push({ ...record, ...result });
  }

  if (writeChanges === true) {
    for (const result of results) {
      const dateValue = Utilities.parseDate(previousCalendarDay(result.endDate), context.timezone, 'yyyy-MM-dd');
      context.trackerSheet.getRange(TRACKER_LAYOUT.endDateRow, result.column).setValue(dateValue);
      context.trackerSheet.getRange(TRACKER_LAYOUT.creditRow, result.column).setValue(
        result.creditCents ? moneyString(result.creditCents) : 'NONE'
      );
    }
    SpreadsheetApp.flush();
  }
  return { participants: results, rates };
}
