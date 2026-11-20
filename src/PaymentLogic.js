/**
 * EXAMPLE ONLY: This function is not your existing payment logic.
 * It takes simple test data and returns reminder messages.
 * Replace or adapt it to your actual Google Sheets columns.
 *
 * Each record: {name, email, amountDue, paid}
 */
function buildPaymentReminders(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  return records
    .filter(function (member) {
      return member.paid !== true && Number(member.amountDue) > 0;
    })
    .map(function (member) {
      return {
        to: member.email,
        subject: "Spotify payment reminder",
        body:
          "Hi " + member.name + ", your example balance is $" +
          Number(member.amountDue).toFixed(2) + "."
      };
    });
}
