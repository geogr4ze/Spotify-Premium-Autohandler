function makeReminderMessage(person, outstanding, monthlyRateCents, ownerEmail, today) {
  const isPartiallyPrepaid = person.creditCents > 0;
  const templateName = isPartiallyPrepaid ? 'OverBalanceEmail' : 'Email';
  const template = HtmlService.createTemplateFromFile(templateName);
  template.name = person.name;
  template.date = displayDate(person.endDate);
  template.today = displayDate(today);
  template.amountDue = moneyString(outstanding.amountCents);
  template.monthlyRate = moneyString(monthlyRateCents);
  template.credit = moneyString(person.creditCents);
  template.periodsDue = outstanding.cyclesDue;
  template.ownerEmail = ownerEmail;

  return {
    to: person.email,
    subject: 'Spotify Premium — payment reminder',
    body: 'Hello ' + person.name + ',\n\n' +
      'Our records show your Spotify Premium contribution was due on ' +
      template.date + '. As of ' + template.today + ', the amount due is ' +
      template.amountDue + ' for ' + outstanding.cyclesDue + ' billing period(s), ' +
      'after any prepaid credit. The current monthly share is ' +
      template.monthlyRate + '.\n\n' +
      'Please send an Interac e-Transfer to ' + ownerEmail +
      '. If you have already paid, please reply so we can check the records.\n\n' +
      'Thank you.',
    htmlBody: template.evaluate().getContent()
  };
}

function makeOwnerAlert(person, outstanding, monthsOverdue, ownerEmail, today) {
  const template = HtmlService.createTemplateFromFile('ManyuEmail');
  template.name = person.name;
  template.date = displayDate(person.endDate);
  template.today = displayDate(today);
  template.months = monthsOverdue;
  template.moneyOwed = moneyString(outstanding.amountCents);
  template.periodsDue = outstanding.cyclesDue;

  return {
    to: ownerEmail,
    subject: 'Spotify Premium — overdue account review',
    body: person.name + ' was paid through ' + template.date +
      '. As of ' + template.today + ', ' + monthsOverdue +
      ' full month(s) have passed since that date. Calculated outstanding: ' +
      template.moneyOwed + ' for ' + outstanding.cyclesDue +
      ' billing period(s). Review the spreadsheet before following up.',
    htmlBody: template.evaluate().getContent()
  };
}

/**
 * Properties are only written after a successful production send.
 * A single due-date/billing-period notification won't be resent each day.
 */
function deliverOnce(message, dedupeKey, config) {
  const properties = getScriptSettings();
  if (config.mode === 'PRODUCTION' && properties.getProperty(dedupeKey)) {
    return 'ALREADY_SENT';
  }
  const result = sendEmailSafely(message, config);
  if (result.status === 'PRODUCTION_SENT') {
    properties.setProperty(dedupeKey, new Date().toISOString());
  }
  return result.status;
}

/** Main scheduled entry point. Safe by default; never uses background colours. */
function runPaymentCycle(now, emailOverride) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another payment cycle is running.');
  try {
    const config = { ...getEmailConfiguration(), ...(emailOverride || {}) };
    if (config.mode === 'PRODUCTION' && !config.allowProductionEmails) {
      throw new Error('Production mail is not authorized.');
    }
    if (!['DRY_RUN', 'TEST', 'PRODUCTION'].includes(config.mode)) {
      throw new Error('Invalid EMAIL_MODE: ' + config.mode);
    }
    const context = getTrackerContext();
    const today = dateKey(now || new Date(), context.timezone);
    if (!today) throw new Error('Invalid run date.');

    let importResult = { disabled: true, imported: 0 };
    if (config.mode === 'PRODUCTION') {
      importResult = addData(context);
      SpreadsheetApp.flush();
    }
    const report = updateParticipants(context, config.mode === 'PRODUCTION');
    const currentRateCents = rateOnDate(report.rates, today);
    const ownerEmail = config.ownerEmail;
    const sent = [];
    for (const person of report.participants) {
      if (person.endDate > today) continue;
      const outstanding = amountOutstanding(
        person.endDate, person.creditCents, report.rates, today
      );
      if (outstanding.amountCents === 0) continue;
      const monthsOverdue = fullMonthsOverdue(person.endDate, today);
      const keyBase = encodeURIComponent(person.email.toLowerCase()) + ':' + person.endDate;
      const message = makeReminderMessage(person, outstanding, currentRateCents, ownerEmail, today);
      sent.push({ type: 'MEMBER', name: person.name,
        status: deliverOnce(message, 'reminder:' + keyBase + ':' + monthsOverdue, config) });

      if (monthsOverdue >= 2) {
        const alert = makeOwnerAlert(person, outstanding, monthsOverdue, ownerEmail, today);
        sent.push({ type: 'OWNER', name: person.name,
          status: deliverOnce(alert, 'owner-alert:' + keyBase + ':' + monthsOverdue, config) });
      }
    }
    return { mode: config.mode, importResult, notifications: sent };
  } finally {
    lock.releaseLock();
  }
}

/** Retain the name used by existing Apps Script time-driven triggers. */
function checkCellFillColor() {
  return runPaymentCycle();
}
