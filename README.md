# Spotify payment tracker — safe VS Code testing starter

This **starter** does not contain or modify your existing implementation. It demonstrates how to test Apps Script-style JavaScript locally without sending any real email.

## Requirements

- VS Code
- Node.js version 20 or newer (includes npm and the built-in test runner)

## First use

1. Unzip this folder and open it in VS Code.
2. Open Terminal > New Terminal.
3. Run `npm test`.
4. All 7 tests should pass without Google sign-in, network access, or email delivery.

There are no npm dependencies to install just to run the tests.

## File layout

- `src/EmailService.js`: three explicit email modes: DRY_RUN, TEST, PRODUCTION.
- `src/PaymentLogic.js`: **sample only** payment reminder selection.
- `src/Code.js`: demonstration function that previews sample reminders, never sending messages.
- `tests/emailSafety.test.js`: automated local tests that replace `MailApp` with an in-memory fake.
- `.vscode/tasks.json`: launch the tests from VS Code's task runner.

## IMPORTANT safety properties

- `npm test` NEVER uses GmailApp, MailApp, real Google accounts, Google Sheets or the internet. `MailApp` is replaced by an in-memory fake.
- No code in this starter runs automatically or schedules triggers.
- Missing email configuration defaults to `DRY_RUN`.
- `TEST` mode routes email only to the specified `testRecipient` **if run on Google Apps Script**; local tests still fake MailApp and never send anything.
- `PRODUCTION` mode requires both `mode: "PRODUCTION"` and `allowProductionEmails: true`. Local tests still intercept calls.
- These protections only apply to calls that go through `sendEmailSafely`. Existing code that calls `GmailApp.sendEmail` or `MailApp.sendEmail` directly is NOT protected.

## Adapting to your current project

1. Start by bringing your real payment-calculation code into the project, **without changing your live script**.
2. Write tests for paid/unpaid balances, monthly dates, amounts, and duplicate reminders using fake input data.
3. Replace direct `MailApp.sendEmail(...)` or `GmailApp.sendEmail(...)` calls with a single wrapper like `sendEmailSafely` in your **test branch**, after reviewing the existing code.
4. For an end-to-end check using actual Google services, make a **separate Google Sheet with fictitious members**, a **separate DEV Apps Script project**, and only your own test email address.
5. Keep live triggers and real members on production only. Review all triggers before switching code on any connected script.

## Optional: connect to a separate DEV Apps Script project with clasp

`clasp` is Google's command-line tool for Apps Script. You only need it to synchronize files with Google (NOT to run the local tests).

```powershell
npm install -g @google/clasp
clasp login
```

Enable the Apps Script API in https://script.google.com/home/usersettings if requested.

Use a DIFFERENT Apps Script script ID for DEV than for production. Create a development script separately and connect to it. Example for creating a new standalone DEV script from this folder:

```powershell
clasp create-script --title "Spotify Tracker DEV" --type standalone --rootDir ./src
```

If your live code relies on `SpreadsheetApp.getActiveSpreadsheet()`, instead create a separate Google Sheet first and use a DEV project bound to that sheet (see clasp's `--parentId` option). Do not point tests to a production sheet.

`clasp push` uploads source to whichever script ID is saved in `.clasp.json`; verify that it is your **DEV** ID before ever using it. For extra safety, do not run `clasp push` until after local tests pass and the target project is checked. Do not use `--force` or `--watch` during setup.

**Important:** Google Apps Script installations with time-driven triggers can execute head code regardless of web-app deployment/versioning. A push to production is a production change even if you never run a deploy command.

## Using your original code

The sample functions in `src/PaymentLogic.js` and `src/Code.js` are just placeholders. Share your existing `.gs` / `.js` source and Google Sheet column layout to adapt these tests to your actual reminder logic without rewriting your application.
