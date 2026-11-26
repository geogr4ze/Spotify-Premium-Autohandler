const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * Build a noon UTC test date.
 * @param {string} key - Date key.
 * @returns {Date} Fixture instant.
 */
function day(key) { return new Date(key + 'T12:00:00Z'); }

class FakeSheet {
  /**
   * Initialize empty fake sheet rows and write count.
   */
  constructor() { this.rows = []; this.writes = 0; }
  /**
   * Store a cell value in the fake sheet.
   * @param {number} row - One-based row.
   * @param {number} column - One-based column.
   * @param {*} value - Cell value.
   * @effects Mutates fake storage without incrementing write count.
   */
  put(row, column, value) {
    if (!this.rows[row - 1]) this.rows[row - 1] = [];
    this.rows[row - 1][column - 1] = value;
  }
  /**
   * Read a fake cell.
   * @param {number} row - One-based row.
   * @param {number} column - One-based column.
   * @returns {*} Stored value or empty string.
   */
  get(row, column) { return this.rows[row - 1]?.[column - 1] ?? ''; }
  /**
   * Return the number of stored row slots.
   * @returns {number} Row count.
   */
  getLastRow() { return this.rows.length; }
  /**
   * Create fake range methods bound to the sheet.
   * @param {number} row - Starting row.
   * @param {number} column - Starting column.
   * @param {number} [numRows] - Height.
   * @param {number} [numCols] - Width.
   * @returns {Object} Range mock.
   */
  getRange(row, column, numRows = 1, numCols = 1) {
    const sheet = this;
    return {
      getValue: () => sheet.get(row, column),
      getValues: () => Array.from({ length: numRows }, (_, r) =>
        Array.from({ length: numCols }, (_, c) => sheet.get(row + r, column + c))),
      setValue: value => { sheet.put(row, column, value); sheet.writes++; },
      setValues: values => {
        for (let r = 0; r < numRows; r++) {
          for (let c = 0; c < numCols; c++) sheet.put(row + r, column + c, values[r][c]);
        }
        sheet.writes++;
      }
    };
  }
  /**
   * Insert empty rows and increment write count.
   * @param {number} start - One-based row.
   * @param {number} count - Rows to insert.
   */
  insertRows(start, count) {
    for (let i = 0; i < count; i++) this.rows.splice(start - 1, 0, []);
    this.writes++;
  }
}

/**
 * Build an isolated fake Apps Script environment.
 * @param {Object} [options] - Settings, messages and behavior overrides.
 * @returns {Object} Test harness.
 */
function setup(options = {}) {
  const tracker = new FakeSheet();
  const emails = new FakeSheet();
  const envSettings = {
    SPREADSHEET_ID: 'fake-sheet',
    OWNER_EMAIL: 'owner@example.com',
    EMAIL_MODE: 'DRY_RUN',
    ...options.settings
  };
  // B:F correspond to five participants; only B is used in most tests.
  tracker.put(4, 2, day(options.join || '2026-10-20'));
  tracker.put(5, 2, 'Alex');
  tracker.put(6, 2, options.paid ?? 5);
  tracker.put(9, 2, 'alex@example.com');
  tracker.put(16, 1, day('2026-01-01'));
  tracker.put(16, 3, 5);
  if (options.priceChange) {
    tracker.put(17, 1, day('2026-11-01'));
    tracker.put(17, 3, 6);
  }
  emails.put(1, 1, 'Subject');

  const sent = [];
  const previews = [];
  const messages = options.messages || [];
  /**
   * Create a mock Gmail message with mutable unread state.
   * @param {Object} details - Fixture fields.
   * @returns {Object} Fake message.
   */
  const fakeMessage = (details) => ({
    ...details,
    /**
     * Return current fixture unread flag.
     * @returns {boolean} Unread state.
     */
    isUnread() { return this.unread; },
    /**
     * Return fixture message identifier.
     * @returns {string} ID.
     */
    getId() { return this.id; },
    /**
     * Return fixture subject.
     * @returns {string} Subject.
     */
    getSubject() { return this.subject; },
    /**
     * Return fixture timestamp.
     * @returns {Date} Date.
     */
    getDate() { return this.date; },
    /**
     * Mark fake message read.
     * @effects Sets unread to false.
     */
    markRead() { this.unread = false; }
  });
  const mailMessages = messages.map(fakeMessage);
  const sheets = { Tracker: tracker, Emails: emails };
  const environment = {
    console: {
      log: message => previews.push(message),
      warn: message => previews.push(message)
    },
    Utilities: {
      /**
       * Stub yyyy-MM-dd formatting.
       * @param {Date} value - Instant.
       * @param {string} tz - Unused timezone.
       * @param {string} format - Expected format.
       * @returns {string} UTC date.
       */
      formatDate(value, tz, format) {
        assert.equal(format, 'yyyy-MM-dd');
        return value.toISOString().slice(0, 10);
      },
      /**
       * Parse fixture date key.
       * @param {string} key - Date key.
       * @returns {Date} Noon UTC.
       */
      parseDate(key) { return day(key); }
    },
    SpreadsheetApp: {
      /**
       * Open the fake spreadsheet, asserting expected ID.
       * @param {string} id - Fake ID.
       * @returns {Object} Mock workbook.
       */
      openById(id) { assert.equal(id, 'fake-sheet'); return {
        /**
         * Look up fake sheet.
         * @param {string} name - Tab name.
         * @returns {Object} Fake sheet.
         */
        getSheetByName(name) { return sheets[name]; },
        /**
         * Return test time zone.
         * @returns {string} UTC.
         */
        getSpreadsheetTimeZone() { return 'UTC'; }
      }; },
      /**
       * No-op mock for spreadsheet flush.
       */
      flush() {}
    },
    HtmlService: {
      /**
       * Build a mock HTML template.
       * @param {string} name - Template fixture.
       * @returns {Object} Mock template.
       */
      createTemplateFromFile(name) { return {
        /**
         * Render fixture HTML content.
         * @returns {Object} Fake rendered content accessor.
         */
        evaluate() {
          return {
            getContent: () => '<html>' + name + ':' + this.name + ':' + this.amountDue + '</html>'
          };
        }
      }; }
    },
    GmailApp: { getUserLabelByName(name) {
      assert.equal(name, 'Spotify Premium Money');
      return options.noLabel ? null : { getThreads: () => [{ getMessages: () => mailMessages }] };
    } },
    MailApp: { sendEmail: message => {
      if (options.mailFails) throw new Error('Mail transport failed');
      sent.push(message);
    } },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => envSettings[key] ?? null,
      setProperty: (key, value) => { envSettings[key] = value; }
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) }
  };
  vm.createContext(environment);
  const sources = ['Globals.gs', 'PaymentLogic.js', 'DataComputator.gs',
    'EmailService.js', 'AutoMoneyReceiver.gs', 'AutoEmailSender.gs', 'Code.js'];
  for (const file of sources) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'),
      environment, { filename: file });
  }
  return { environment, tracker, emails, sent, previews, envSettings, mailMessages };
}

test('money parsing is precise and rejects malformed amounts', () => {
  const { environment: e } = setup();
  assert.equal(e.parseMoneyCents('$1,234.50'), 123450);
  assert.equal(e.parseMoneyCents('NONE'), 0);
  assert.equal(e.parseMoneyCents(0), 0);
  assert.throws(() => e.parseMoneyCents('abc'));
  assert.throws(() => e.parseMoneyCents('-5'));
});

test('month-end dates stay anchored rather than overflowing in February', () => {
  const { environment: e } = setup();
  assert.equal(e.addCalendarMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(e.addCalendarMonths('2026-01-31', 2), '2026-03-31');
  assert.equal(e.addCalendarMonths('2028-01-31', 1), '2028-02-29');
});

test('rate changes apply from their effective billing date', () => {
  const { environment: e } = setup();
  const rates = [{ startDate: '2026-01-01', cents: 500 }, { startDate: '2026-03-01', cents: 600 }];
  const result = e.calculateCoverage('2026-02-15', 1600, rates);
  assert.equal(result.endDate, '2026-04-15');
  assert.equal(result.creditCents, 500);
});

test('zero total paid resets stale end dates without skipping participant', () => {
  const { environment: e, tracker } = setup({ paid: 0 });
  tracker.put(7, 2, day('2099-01-01'));
  const result = e.updateParticipants(e.getTrackerContext(), true);
  assert.equal(result.participants[0].endDate, '2026-10-20');
  assert.equal(tracker.get(8, 2), 'NONE');
});

test('dry run previews due date without writing sheets or sending any mail', () => {
  const { environment: e, tracker, sent, emails } = setup();
  const report = e.runPaymentCycle('2026-11-20');
  assert.equal(report.mode, 'DRY_RUN');
  assert.equal(report.notifications[0].status, 'PREVIEW_ONLY');
  assert.equal(sent.length, 0);
  assert.equal(tracker.writes, 0);
  assert.equal(emails.writes, 0);
});

test('future-paid participant is not reminded', () => {
  const { environment: e, sent } = setup({ paid: 10 });
  const report = e.runPaymentCycle('2026-11-10');
  assert.equal(report.notifications.length, 0);
  assert.equal(sent.length, 0);
});

test('test mode redirects all messages to owner, with no spreadsheet changes', () => {
  const { environment: e, tracker, emails, sent } = setup({ settings: { EMAIL_MODE: 'TEST' } });
  const report = e.runPaymentCycle('2026-11-20');
  assert.equal(report.notifications[0].status, 'TEST_SENT');
  assert.equal(sent[0].to, 'owner@example.com');
  assert.equal(tracker.writes, 0);
  assert.equal(emails.writes, 0);
});

test('production mode fails closed unless explicitly authorized', () => {
  const { environment: e, tracker, sent } = setup({ settings: { EMAIL_MODE: 'PRODUCTION' } });
  assert.throws(() => e.runPaymentCycle('2026-11-20'), /not authorized/);
  assert.equal(tracker.writes, 0);
  assert.equal(sent.length, 0);
});

test('production reminder is sent once for each overdue billing period', () => {
  const { environment: e, sent, envSettings } = setup({
    settings: { EMAIL_MODE: 'PRODUCTION', ALLOW_PRODUCTION_EMAILS: 'true' }
  });
  const first = e.runPaymentCycle('2026-11-20');
  const second = e.runPaymentCycle('2026-11-21');
  assert.equal(first.notifications[0].status, 'PRODUCTION_SENT');
  assert.equal(second.notifications[0].status, 'ALREADY_SENT');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'alex@example.com');
  assert.ok(Object.keys(envSettings).some(key => key.startsWith('reminder:')));
});

test('a failed send does not create a sent marker', () => {
  const { environment: e, envSettings } = setup({
    mailFails: true, settings: { EMAIL_MODE: 'PRODUCTION', ALLOW_PRODUCTION_EMAILS: 'true' }
  });
  assert.throws(() => e.runPaymentCycle('2026-11-20'), /Mail transport failed/);
  assert.equal(Object.keys(envSettings).filter(key => key.startsWith('reminder:')).length, 0);
});

test('two full overdue months generate an owner report, but not every day', () => {
  const { environment: e, sent } = setup({
    join: '2026-08-20', paid: 5,
    settings: { EMAIL_MODE: 'PRODUCTION', ALLOW_PRODUCTION_EMAILS: 'true' }
  });
  const report = e.runPaymentCycle('2026-11-20');
  assert.equal(report.notifications.length, 2);
  assert.equal(sent.filter(message => message.to === 'owner@example.com').length, 1);
  e.runPaymentCycle('2026-11-21');
  assert.equal(sent.length, 2);
});

test('partial credit reduces outstanding balance rather than becoming overdue debt', () => {
  const { environment: e } = setup({ paid: 2 });
  const report = e.updateParticipants(e.getTrackerContext(), false);
  assert.equal(report.participants[0].endDate, '2026-10-20');
  assert.equal(report.participants[0].creditCents, 200);
  const outstanding = e.amountOutstanding('2026-10-20', 200, report.rates, '2026-10-20');
  assert.equal(outstanding.amountCents, 300);
});

test('payment parsing accepts known format but refuses unknown notifications', () => {
  const { environment: e } = setup();
  const parsed = e.parsePaymentSubject('You received $5.25 from Alex Smith and the transfer was deposited');
  assert.equal(parsed.name, 'Alex Smith');
  assert.equal(parsed.amount, 5.25);
  assert.equal(e.parsePaymentSubject('Your payment arrived'), null);
});

test('payment import records message ID and is safe on repeated processing', () => {
  const message = { id: 'msg-1', unread: true,
    subject: 'You received $5.00 from Alex Smith and the transfer was deposited',
    date: day('2026-11-20') };
  const { environment: e, emails, mailMessages } = setup({ messages: [message],
    settings: { ENABLE_PAYMENT_IMPORT: 'true' } });
  const first = e.addData(e.getTrackerContext());
  assert.equal(first.imported, 1);
  assert.equal(emails.get(2, 3), 'Alex Smith');
  assert.equal(emails.get(2, 4), 5);
  assert.equal(emails.get(2, 5), 'msg-1');
  mailMessages[0].unread = true;
  const second = e.addData(e.getTrackerContext());
  assert.equal(second.imported, 0);
  assert.equal(mailMessages[0].unread, false);
});

test('unrecognized payment notification is not marked read or imported', () => {
  const { environment: e, emails, mailMessages } = setup({
    messages: [{ id: 'bad-msg', unread: true, subject: 'Unknown notice', date: day('2026-11-20') }],
    settings: { ENABLE_PAYMENT_IMPORT: 'true' }
  });
  const result = e.addData(e.getTrackerContext());
  assert.equal(result.skipped, 1);
  assert.equal(mailMessages[0].unread, true);
  assert.equal(emails.getLastRow(), 1);
});

test('rate table stops at a blank row instead of reading later unrelated data', () => {
  const { environment: e, tracker } = setup();
  tracker.put(22, 1, day('2026-09-01'));
  tracker.put(22, 3, 99);
  const rates = e.readRateSchedule(e.getTrackerContext());
  assert.equal(rates.length, 1);
  assert.equal(rates[0].cents, 500);
});

test('the two email templates describe the amount due and prepaid credit', () => {
  const root = path.join(__dirname, '..', 'src');
  const normal = fs.readFileSync(path.join(root, 'Email.html'), 'utf8');
  const credit = fs.readFileSync(path.join(root, 'OverBalanceEmail.html'), 'utf8');
  const owner = fs.readFileSync(path.join(root, 'ManyuEmail.html'), 'utf8');
  assert.match(normal, /Amount currently due: <\?= amountDue \?>/);
  assert.match(credit, /Prepaid credit applied: <\?= credit \?>/);
  assert.match(owner, /verify the spreadsheet/i);
});

test('manual preview remains safe even when configured for production', () => {
  const { environment: e, sent, tracker, emails } = setup({
    settings: { EMAIL_MODE: 'PRODUCTION', ALLOW_PRODUCTION_EMAILS: 'true', ENABLE_PAYMENT_IMPORT: 'true' }
  });
  const report = e.previewPaymentReminders();
  assert.equal(report.mode, 'DRY_RUN');
  assert.equal(sent.length, 0);
  assert.equal(tracker.writes, 0);
  assert.equal(emails.writes, 0);
});


test('manual arguments cannot promote DRY_RUN to production', () => {
  const { environment: e, sent, tracker } = setup();
  const result = e.runPaymentCycle('2026-11-20', {
    mode: 'PRODUCTION', allowProductionEmails: true
  });
  assert.equal(result.mode, 'DRY_RUN');
  assert.equal(sent.length, 0);
  assert.equal(tracker.writes, 0);
});

test('payment calculation inspector logs a read-only summary even in production mode', () => {
  const { environment: e, tracker, emails, sent, previews } = setup({
    paid: 7,
    settings: {
      EMAIL_MODE: 'PRODUCTION',
      ALLOW_PRODUCTION_EMAILS: 'true',
      ENABLE_PAYMENT_IMPORT: 'true'
    }
  });
  tracker.put(7, 2, day('2099-01-01'));
  tracker.put(8, 2, '$99.99');
  const report = e.testUpdateParticipants();

  assert.equal(report.length, 1);
  assert.equal(report[0].name, 'Alex');
  assert.equal(report[0].totalPaid, '$7.00');
  assert.equal(report[0].calculatedEndDate, '2026-11-20');
  assert.equal(report[0].prepaidCredit, '$2.00');
  assert.equal(report[0].monthsPaid, 1);
  assert.match(previews[0], /"calculatedEndDate": "2026-11-20"/);
  assert.equal(tracker.get(7, 2).toISOString().slice(0, 10), '2099-01-01');
  assert.equal(tracker.get(8, 2), '$99.99');
  assert.equal(tracker.writes, 0);
  assert.equal(emails.writes, 0);
  assert.equal(sent.length, 0);
});

test('manual tracker update writes rows 7 and 8 without touching Gmail or mail', () => {
  const { environment: e, tracker, emails, sent } = setup({ paid: 7 });
  const updated = e.updateTrackerValues();
  assert.equal(updated.length, 1);
  assert.equal(updated[0].name, 'Alex');
  assert.equal(updated[0].totalPaid, '$7.00');
  assert.equal(updated[0].nextBillingDate, '2026-11-20');
  assert.equal(updated[0].endMonth, '2026-11-19');
  assert.equal(updated[0].prepaidCredit, '$2.00');
  assert.equal(tracker.get(7, 2).toISOString().slice(0, 10), '2026-11-19');
  assert.equal(tracker.get(8, 2), '$2.00');
  assert.equal(tracker.writes, 2);
  assert.equal(emails.writes, 0);
  assert.equal(sent.length, 0);
});

test('manual tracker update accepts zero payments and replaces stale end months', () => {
  const { environment: e, tracker, emails, sent } = setup({ paid: 0 });
  tracker.put(7, 2, day('2026-12-19'));
  tracker.put(8, 2, '$2.50');

  const updated = e.updateTrackerValues();

  assert.equal(updated.length, 1);
  assert.equal(updated[0].totalPaid, '$0.00');
  assert.equal(updated[0].nextBillingDate, '2026-10-20');
  assert.equal(updated[0].endMonth, '2026-10-19');
  assert.equal(updated[0].prepaidCredit, '$0.00');
  assert.equal(tracker.get(7, 2).toISOString().slice(0, 10), '2026-10-19');
  assert.equal(tracker.get(8, 2), 'NONE');
  assert.equal(tracker.writes, 2);
  assert.equal(emails.writes, 0);
  assert.equal(sent.length, 0);
});

test('manual tracker update accepts mixed paid and unpaid participants', () => {
  const { environment: e, tracker, emails, sent } = setup({ paid: 10 });
  tracker.put(4, 3, day('2026-10-20'));
  tracker.put(5, 3, 'Taylor');
  tracker.put(6, 3, 0);
  tracker.put(7, 3, day('2026-12-19'));
  tracker.put(8, 3, '$1.00');
  tracker.put(9, 3, 'taylor@example.com');

  const updated = e.updateTrackerValues();

  assert.equal(updated.length, 2);
  assert.equal(updated[0].nextBillingDate, '2026-12-20');
  assert.equal(updated[1].totalPaid, '$0.00');
  assert.equal(updated[1].endMonth, '2026-10-19');
  assert.equal(tracker.get(7, 3).toISOString().slice(0, 10), '2026-10-19');
  assert.equal(tracker.get(8, 3), 'NONE');
  assert.equal(tracker.writes, 4);
  assert.equal(emails.writes, 0);
  assert.equal(sent.length, 0);
});

test('manual tracker update refuses production or owner-only email mode', () => {
  for (const mode of ['PRODUCTION', 'TEST']) {
    const { environment: e, tracker, sent } = setup({
      settings: { EMAIL_MODE: mode, ALLOW_PRODUCTION_EMAILS: 'true' }
    });
    assert.throws(() => e.updateTrackerValues(), /require EMAIL_MODE=DRY_RUN/);
    assert.equal(tracker.writes, 0);
    assert.equal(sent.length, 0);
  }
});

test('manual tracker update preserves one-day end-month convention across year boundaries', () => {
  const { environment: e, tracker } = setup({ join: '2026-12-31', paid: 5 });
  const report = e.updateTrackerValues();
  assert.equal(report[0].nextBillingDate, '2027-01-31');
  assert.equal(report[0].endMonth, '2027-01-30');
  assert.equal(tracker.get(7, 2).toISOString().slice(0, 10), '2027-01-30');
});


test('import-only review records new payments without sending mail or editing Tracker', () => {
  const { environment: e, tracker, emails, sent, mailMessages } = setup({
    settings: {
      EMAIL_MODE: 'DRY_RUN',
      ALLOW_PRODUCTION_EMAILS: 'false',
      ENABLE_PAYMENT_IMPORT: 'true'
    },
    messages: [
      {
        id: 'review-msg-1', unread: true,
        subject: 'You received $4.50 from Alex and the transfer was deposited',
        date: day('2026-11-20')
      },
      {
        id: 'unknown-msg', unread: true,
        subject: 'Your transfer was deposited',
        date: day('2026-11-20')
      }
    ]
  });

  const first = e.importPaymentsForReview();
  assert.equal(first.imported, 1);
  assert.equal(first.skipped, 1);
  assert.equal(emails.get(2, 3), 'Alex');
  assert.equal(emails.get(2, 4), 4.5);
  assert.equal(emails.get(2, 5), 'review-msg-1');
  assert.equal(mailMessages[0].unread, false);
  assert.equal(mailMessages[1].unread, true);
  assert.equal(tracker.writes, 0);
  assert.equal(sent.length, 0);

  // Even if the same message is marked unread again, the Gmail ID prevents
  // importing it twice.
  mailMessages[0].unread = true;
  const second = e.importPaymentsForReview();
  assert.equal(second.imported, 0);
  assert.equal(mailMessages[0].unread, false);
  assert.equal(tracker.writes, 0);
  assert.equal(sent.length, 0);
});

test('import-only review requires explicit import permission and no live mail', () => {
  for (const settings of [
    { EMAIL_MODE: 'DRY_RUN', ALLOW_PRODUCTION_EMAILS: 'false', ENABLE_PAYMENT_IMPORT: 'false' },
    { EMAIL_MODE: 'TEST', ALLOW_PRODUCTION_EMAILS: 'false', ENABLE_PAYMENT_IMPORT: 'true' },
    { EMAIL_MODE: 'PRODUCTION', ALLOW_PRODUCTION_EMAILS: 'false', ENABLE_PAYMENT_IMPORT: 'true' },
    { EMAIL_MODE: 'DRY_RUN', ALLOW_PRODUCTION_EMAILS: 'true', ENABLE_PAYMENT_IMPORT: 'true' }
  ]) {
    const { environment: e, tracker, emails, sent } = setup({ settings });
    assert.throws(() => e.importPaymentsForReview(), /Import review requires/);
    assert.equal(tracker.writes, 0);
    assert.equal(emails.writes, 0);
    assert.equal(sent.length, 0);
  }
});
