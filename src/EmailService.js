/**
 * Safely sends or previews a message depending on the mode.
 * Apps Script globals MailApp and console are available when run on Google.
 * For local tests, MailApp is replaced with a fake implementation.
 *
 * Modes:
 * DRY_RUN (default): preview only, never sends
 * TEST: routes everything to one configured test inbox
 * PRODUCTION: only sends if explicitly authorized
 */
function sendEmailSafely(message, configuration) {
  const config = configuration || {};
  const mode = config.mode || "DRY_RUN";

  if (!message || !message.to || !message.subject || !message.body) {
    throw new Error("A complete email message is required");
  }

  if (mode === "DRY_RUN") {
    console.log("[DRY RUN] Would email " + message.to + ": " + message.subject);
    return { status: "PREVIEW_ONLY", recipient: message.to };
  }

  if (mode === "TEST") {
    if (!config.testRecipient || !config.testRecipient.includes("@")) {
      throw new Error("TEST mode requires a valid testRecipient");
    }
    MailApp.sendEmail(
      config.testRecipient,
      "[TEST: intended for " + message.to + "] " + message.subject,
      message.body
    );
    return { status: "TEST_SENT", recipient: config.testRecipient };
  }

  if (mode === "PRODUCTION") {
    if (config.allowProductionEmails !== true) {
      throw new Error("Production email sending is disabled");
    }
    MailApp.sendEmail(message.to, message.subject, message.body);
    return { status: "PRODUCTION_SENT", recipient: message.to };
  }

  throw new Error("Unknown email mode: " + mode);
}
