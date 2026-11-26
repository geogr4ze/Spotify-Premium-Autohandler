/** All outgoing emails must go through this fail-closed gateway. */
/**
 * Read configured email mode, production authorization and owner address.
 * @returns {Object} Normalized mode, authorization and ownerEmail.
 * @throws {Error} Missing/invalid owner address.
 */
function getEmailConfiguration() {
  const properties = getScriptSettings();
  return {
    mode: (properties.getProperty('EMAIL_MODE') || 'DRY_RUN').trim().toUpperCase(),
    allowProductionEmails: properties.getProperty('ALLOW_PRODUCTION_EMAILS') === 'true',
    ownerEmail: getOwnerEmail()
  };
}

/**
 * Route email through the fail-closed gateway.
 * @param {Object} message - Recipient, subject, body and HTML.
 * @param {Object} [configuration] - Mode, owner and authorization.
 * @returns {{status:string}} PREVIEW_ONLY, TEST_SENT or PRODUCTION_SENT.
 * @effects TEST sends only to owner; PRODUCTION requires authorization.
 * @throws {Error} Invalid input, mode, authorization or mail failure.
 */
function sendEmailSafely(message, configuration) {
  const config = configuration || { mode: 'DRY_RUN' };
  const mode = config.mode || 'DRY_RUN';
  if (!message || !isValidEmailAddress(message.to) ||
      !message.subject || !message.body || !message.htmlBody) {
    throw new Error('A complete email with a valid recipient and HTML is required.');
  }

  if (mode === 'DRY_RUN') {
    console.log('[DRY_RUN] ' + message.subject + ' (email not sent)');
    return { status: 'PREVIEW_ONLY' };
  }

  if (mode === 'TEST') {
    // Never let TEST mode send to an actual member, even if misconfigured.
    if (!isValidEmailAddress(config.ownerEmail)) {
      throw new Error('TEST requires a configured OWNER_EMAIL.');
    }
    MailApp.sendEmail({
      to: config.ownerEmail,
      subject: '[TEST, intended for ' + message.to + '] ' + message.subject,
      body: message.body,
      htmlBody: message.htmlBody,
      name: 'Spotify Payment Tracker'
    });
    return { status: 'TEST_SENT' };
  }

  if (mode === 'PRODUCTION') {
    if (config.allowProductionEmails !== true) {
      throw new Error('Production email sending is disabled.');
    }
    MailApp.sendEmail({
      to: message.to,
      subject: message.subject,
      body: message.body,
      htmlBody: message.htmlBody,
      name: 'Spotify Payment Tracker',
      replyTo: config.ownerEmail
    });
    return { status: 'PRODUCTION_SENT' };
  }
  throw new Error('Unsupported EMAIL_MODE: ' + mode);
}
