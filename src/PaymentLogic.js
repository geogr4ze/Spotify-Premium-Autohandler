/** Pure date and money calculations shared by Apps Script and Node tests. */
function parseMoneyCents(value) {
  if (value === null || value === undefined || value === '' || value === 'NONE') return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid nonnegative amount.');
    return Math.round(value * 100);
  }
  const text = String(value).trim();
  if (text.toUpperCase() === 'NONE' || text === '') return 0;
  if (!/^\$?\s*(?:\d+(?:,\d{3})*(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) {
    throw new Error('Invalid amount: ' + text);
  }
  return Math.round(Number(text.replace(/[$,\s]/g, '')) * 100);
}

function moneyString(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function dateKey(value, timezone) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (Object.prototype.toString.call(value) !== '[object Date]' ||
      !Number.isFinite(value.getTime())) return null;
  return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
}

/** Stable monthly anniversaries: Jan 31 + 1 month = Feb 28, + 2 = Mar 31. */
function addCalendarMonths(key, count) {
  const parts = key.split('-').map(Number);
  const monthIndex = (parts[0] * 12 + parts[1] - 1) + count;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return String(year).padStart(4, '0') + '-' +
    String(month).padStart(2, '0') + '-' +
    String(Math.min(parts[2], lastDay)).padStart(2, '0');
}

function rateOnDate(rates, key) {
  if (!rates.length) throw new Error('At least one monthly rate is required.');
  // Earliest configured price is used before the first dated change.
  let cents = rates[0].cents;
  for (const rate of rates) {
    if (rate.startDate > key) break;
    cents = rate.cents;
  }
  return cents;
}

/** Total contributions buy full monthly periods; any remainder is prepaid credit. */
function calculateCoverage(joinDate, amountCents, rates) {
  if (!joinDate || !/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) {
    throw new Error('A valid join date is required.');
  }
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error('Total contributions must be nonnegative cents.');
  }
  let creditCents = amountCents;
  let monthsPaid = 0;
  while (monthsPaid < 1200) {
    const billDate = addCalendarMonths(joinDate, monthsPaid);
    const rateCents = rateOnDate(rates, billDate);
    if (creditCents < rateCents) break;
    creditCents -= rateCents;
    monthsPaid++;
  }
  if (monthsPaid === 1200) throw new Error('Contribution history is unexpectedly large.');
  return {
    endDate: addCalendarMonths(joinDate, monthsPaid),
    creditCents,
    monthsPaid
  };
}

/** Number of monthly anniversaries passed since the paid-through date. */
function fullMonthsOverdue(endDate, today) {
  if (endDate > today) return 0;
  let months = 0;
  while (months < 1200 && addCalendarMonths(endDate, months + 1) <= today) {
    months++;
  }
  return months;
}

/** Includes the cycle due today; past cycles are billed at their historical rates. */
function amountOutstanding(endDate, creditCents, rates, today) {
  if (endDate > today) return { amountCents: 0, cyclesDue: 0 };
  const overdueMonths = fullMonthsOverdue(endDate, today);
  let amountCents = -creditCents;
  for (let i = 0; i <= overdueMonths; i++) {
    amountCents += rateOnDate(rates, addCalendarMonths(endDate, i));
  }
  return { amountCents: Math.max(0, amountCents), cyclesDue: overdueMonths + 1 };
}

function displayDate(key) {
  const parts = key.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return names[parts[1] - 1] + ' ' + parts[2] + ', ' + parts[0];
}
