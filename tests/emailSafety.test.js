const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadCode() {
  const sent = [];
  const previews = [];
  const environment = {
    console: { log: (message) => previews.push(message) },
    MailApp: { sendEmail: (...arguments_) => sent.push(arguments_) }
  };
  vm.createContext(environment);
  for (const file of ["EmailService.js", "PaymentLogic.js", "Code.js"]) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"),
      environment,
      { filename: file }
    );
  }
  return { environment, sent, previews };
}

const exampleMessage = {
  to: "real-member@example.com",
  subject: "Payment due",
  body: "This is a sample reminder."
};

test("defaults to dry run and sends no messages", () => {
  const { environment, sent, previews } = loadCode();
  const result = environment.sendEmailSafely(exampleMessage);
  assert.equal(result.status, "PREVIEW_ONLY");
  assert.equal(sent.length, 0);
  assert.equal(previews.length, 1);
});

test("TEST mode redirects all emails to the test inbox", () => {
  const { environment, sent } = loadCode();
  environment.sendEmailSafely(exampleMessage, {
    mode: "TEST",
    testRecipient: "my-test-inbox@example.com"
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "my-test-inbox@example.com");
  assert.match(sent[0][1], /\[TEST:/);
});

test("TEST mode without test address fails safely", () => {
  const { environment, sent } = loadCode();
  assert.throws(() => environment.sendEmailSafely(exampleMessage, { mode: "TEST" }));
  assert.equal(sent.length, 0);
});

test("production mode cannot send without explicit approval", () => {
  const { environment, sent } = loadCode();
  assert.throws(() => environment.sendEmailSafely(exampleMessage, { mode: "PRODUCTION" }));
  assert.equal(sent.length, 0);
});

test("explicitly approved production mode uses the intended address", () => {
  const { environment, sent } = loadCode();
  environment.sendEmailSafely(exampleMessage, {
    mode: "PRODUCTION",
    allowProductionEmails: true
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "real-member@example.com");
});

test("sample payment logic excludes members who already paid", () => {
  const { environment, sent } = loadCode();
  const reminders = environment.buildPaymentReminders([
    { name: "A", email: "a@example.com", amountDue: 5, paid: false },
    { name: "B", email: "b@example.com", amountDue: 5, paid: true },
    { name: "C", email: "c@example.com", amountDue: 0, paid: false }
  ]);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].to, "a@example.com");
  assert.equal(sent.length, 0);
});

test("manual sample preview sends zero emails", () => {
  const { environment, sent, previews } = loadCode();
  const count = environment.previewExampleReminders();
  assert.equal(count, 1);
  assert.equal(sent.length, 0);
  assert.equal(previews.length, 1);
});
