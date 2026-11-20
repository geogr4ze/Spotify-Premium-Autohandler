# Spotify Premium Autohandler

Google Apps Script payment tracker with **safe local tests** and a controlled email release process. The project reads the five paying participants in the **Tracker** sheet, calculates paid-through dates from cumulative contributions, processes recognized Gmail payment notices, and generates polite payment reminders.

## Safety first

- `EMAIL_MODE` defaults to `DRY_RUN`: **no emails, Gmail imports, spreadsheet writes, or marking messages read** when running the scheduled `checkCellFillColor()` entry point.
- `TEST` sends generated reminders **only to `OWNER_EMAIL`**. It does not import Gmail messages or edit the spreadsheet.
- `PRODUCTION` sends real reminders **only** when `ALLOW_PRODUCTION_EMAILS` is exactly `true`.
- Gmail payment import is a separate opt-in (`ENABLE_PAYMENT_IMPORT=true`) and only runs in `PRODUCTION`.
- Real production reminders are deduplicated for each recipient, paid-through date, and billing period using Apps Script script properties. An owner alert is generated when someone is at least two full calendar months overdue, at most once per overdue month. A send that fails does not create a success marker.
- Use **a separate development Apps Script project and test spreadsheet**. `clasp push` to your production script can immediately change code used by time-driven triggers, even without a deploy command.

### Configuration in Apps Script

Open **Project Settings → Script properties** for the script you intend to run and set:

| Property | Example / allowed value | Purpose |
| --- | --- | --- |
| `SPREADSHEET_ID` | Your spreadsheet ID | Required; *never commit personal sheet IDs*. |
| `OWNER_EMAIL` | Your own email | Required; TEST emails go here. |
| `EMAIL_MODE` | `DRY_RUN`, `TEST`, `PRODUCTION` | Defaults to DRY_RUN. |
| `ALLOW_PRODUCTION_EMAILS` | `false` or `true` | Exact lowercase `true` enables live sending in PRODUCTION mode. |
| `ENABLE_PAYMENT_IMPORT` | `false` or `true` | Exact lowercase `true` enables Gmail payment ingestion in PRODUCTION mode only. |

**Initial recommended state:** `EMAIL_MODE=DRY_RUN`, `ALLOW_PRODUCTION_EMAILS=false`, `ENABLE_PAYMENT_IMPORT=false`. Set the spreadsheet ID and owner email for the **development copy**, not your live spreadsheet. `TEST` sends real messages to the owner inbox only; use `DRY_RUN` to guarantee no email at all.

**Before enabling PRODUCTION**, use the actual latest Tracker balances to review the calculated messages. The first production run may notify overdue members who were already contacted by the old script; new duplicate-send markers cannot reconstruct past emails. Confirm that production triggers invoke only `checkCellFillColor` and that no other script sends messages independently. A live trigger is not required during development.

## Tracker sheet layout (existing format)

| Row / range | Content |
| --- | --- |
| `B4:F4` | Join dates |
| `B5:F5` | Member names |
| `B6:F6` | **Cumulative paid amount** per member, including historical payments |
| `B7:F7` | Calculated paid-through dates (written only in PRODUCTION) |
| `B8:F8` | Unused prepaid credit, or `NONE` (not overdue debt) |
| `B9:F9` | Member email addresses |
| `A16:A...`, `C16:C...` | Price effective date and monthly share; **contiguous rows**, with a blank row after the rate table |
| `Emails!A:E` | Payment subject, date, sender name, amount, Gmail message ID (ID is an added fifth column) |

The script assumes a monthly charge on each participant's **join-date anniversary**, with the rate in effect on that billing date. If the rate table starts after a member's join date, the earliest listed rate is used for older months. Verify that your rate history is complete before enabling production. Dates are compared in the spreadsheet's timezone. A join day of the 29th–31st is clamped to month end, then restored on months that support it.

Your existing green/yellow/red **conditional formatting stays in Google Sheets**, but the script no longer reads background colours. Reminders are based on the calculated date: green = future, yellow = today, red = past. The calculated outstanding amount includes all unpaid monthly periods through today, minus any prepaid credit.

## Gmail payment notices

The original code extracted sender names and amounts from fixed spreadsheet string positions. The replacement recognizes subjects containing **`received`, `from NAME and`, and a `$12.34`-style amount**. It leaves unknown formats unread and **does not import them**. The old Gmail label name remains `Spotify Premium Money`.

**Important:** Before switching `ENABLE_PAYMENT_IMPORT` to `true`, compare several **redacted real payment subject lines** with the parser and its tests. Banks use different formats, and this code has not been tested with your live notifications. In particular, verify that a subject contains exactly the monetary amount you intend to record and that the extracted sender name matches your Tracker formulas. Do not infer payment receipt from an arbitrary email; only use your trusted Gmail label.

On successful import, the Gmail message ID is written to `Emails!E` to prevent double-importing an already recorded message. Existing historical rows have no IDs, so reconcile any unread legacy notifications before the first enabled import. The script marks a message read **after** the new row is written, and it does not change its starred status.

## Local testing in VS Code

1. Install Node.js 20+ and open the repository in VS Code.
2. Open **Terminal → New Terminal** and run `npm test` (no dependencies need installing).
3. The tests load your real `.gs` and `.js` files into an isolated Node VM with mocked Gmail, Sheets, MailApp, HtmlService, and script properties. **They cannot send real emails or alter Google Sheets.**
4. To add scenarios, extend `tests/paymentTracker.test.js`. VS Code recognizes `.gs` files as JavaScript through `.vscode/settings.json`.

Use the function `previewPaymentReminders()` in Apps Script to preview due messages against the configured sheet without changing it or sending emails. Its return value includes notification statuses, but not rendered email HTML. To inspect actual email appearance, use the separate DEV project with `EMAIL_MODE=TEST`, using fictional participants and your own recipient email.

## Connecting only a development Apps Script project

Google's `clasp` is optional for running local tests. To sync with Apps Script, install it and set up a **separate development script** (see [Google's clasp instructions](https://developers.google.com/apps-script/guides/clasp)). Configure the development project's `SPREADSHEET_ID` to a duplicate sheet with fictitious names and addresses. Verify that the ignored `.clasp.json` targets **DEV**, not your existing production script, before every push.

Do **not** push this branch directly to your live script without checking its manifest, triggers, existing spreadsheet formulas, account permissions, and properties. The code here is not yet verified against a real copy of your workbook or actual bank subjects.

## Main files

- `src/Globals.gs`: settings and fresh participant data
- `src/PaymentLogic.js`: precise currency/date/billing calculations
- `src/DataComputator.gs`: calculates rows 7–8 using dated monthly rates
- `src/AutoMoneyReceiver.gs`: opt-in, idempotent Gmail payment import
- `src/EmailService.js`: dry-run, owner-only test, and guarded production mail
- `src/AutoEmailSender.gs`: reminder selection, email templating, per-period dedupe
- `src/Code.js`: always-safe manual preview function
- `src/*.html`: professional HTML email templates
- `tests/paymentTracker.test.js`: regression suite for the **actual app code**

## Deployment caveats

The implementation has been tested locally with mocks, not against your live spreadsheet or Gmail. Rate history, existing Tracker formulas, payment subject lines, and historical read/unread state must be checked with redacted examples before enabling payment import or member emails. This branch does **not** change the live Google Apps Script project automatically; merging a GitHub PR is also not a live deployment unless you explicitly synchronize it with Apps Script.
