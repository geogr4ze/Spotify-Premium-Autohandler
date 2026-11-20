/**
 * Optional manual Apps Script preview. No emails are sent.
 * Do NOT attach this example function to an automatic trigger.
 */
function previewExampleReminders() {
  const sampleMembers = [
    { name: "Member A", email: "member-a@example.com", amountDue: 4.50, paid: false },
    { name: "Member B", email: "member-b@example.com", amountDue: 4.50, paid: true }
  ];

  const messages = buildPaymentReminders(sampleMembers);
  messages.forEach(function (message) {
    sendEmailSafely(message); // Missing configuration ALWAYS defaults to DRY_RUN.
  });
  return messages.length;
}
