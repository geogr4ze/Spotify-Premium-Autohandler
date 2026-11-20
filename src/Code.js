/**
 * Safe manual preview for the Apps Script editor.
 * Reads the tracker but does not send mail, import Gmail, mark mail read,
 * or modify the spreadsheet, even if the project is set to PRODUCTION.
 */
function previewPaymentReminders() {
  return runPaymentCycle(undefined, true);
}
