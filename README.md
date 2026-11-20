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

To **write** recalculated end months and prepaid credit to the DEV Tracker after adding sample payments to the Emails tab, run `updateTrackerValues()` manually in Apps Script. It requires `EMAIL_MODE=DRY_RUN` and `ALLOW_PRODUCTION_EMAILS=false`, never sends emails or accesses Gmail, and refuses to overwrite old saved coverage when cumulative payment records are missing. It writes only `Tracker!B7:F8` for active participants. Row 7 follows the original sheet convention: the **last covered day**, one day before the next billing date; reminder calculations still use the next billing date. Review `testUpdateParticipants()` output first and ensure `SPREADSHEET_ID` points to your DEV sheet.\n\nUse `testUpdateParticipants()` in the Apps Script function dropdown to log each participant's cumulative paid amount, calculated next billing date, unused credit, and months covered. This inspector **never writes the sheet or sends email**, even if `EMAIL_MODE=PRODUCTION`; an empty DEV `Emails` tab means cumulative-paid formulas may show zero and the calculated dates may differ from saved rows 7–8.

Use the function `previewPaymentReminders()` in Apps Script to preview due messages against the configured sheet without changing it or sending emails. Its return value includes notification statuses, but not rendered email HTML. To inspect actual email appearance, use the separate DEV project with `EMAIL_MODE=TEST`, using fictional participants and your own recipient email.

## Safe DEV deployment from VS Code

This repository includes a V8 Apps Script manifest and a helper that creates a
**new, separate Google Apps Script development project**. It does not connect to
or update the production script.

**Requirements:** Node.js 20+, [Google clasp](https://developers.google.com/apps-script/guides/clasp),
and your Google login. Install and authorize clasp, and enable the Apps Script API
in your [Apps Script settings](https://script.google.com/home/usersettings):

```powershell
npm install -g @google/clasp
clasp login
```

1. Duplicate your **Google Sheet**, including the `Tracker` and `Emails` tabs,
   formulas, and dated rate table. Replace all member email addresses with your
   own test address or fictional data. Do not point DEV at your live sheet.
2. In VS Code, use the repository root (not `src/`). After updating your local
   branch, run:

   ```powershell
   npm test
   npm run dev:create
   ```

   This creates a new standalone project titled **Spotify Premium Autohandler DEV**
   in a temporary folder. It saves the newly created ID to local, ignored
   `.clasp.json` and `.clasp-dev.json`. It refuses to overwrite an existing
   clasp link. The temporary folder prevents clasp's default starter files from
   overwriting your application.
3. Open the new Apps Script link printed by `dev:create`. In **Project Settings →
   Script properties**, enter:

   ```text
   SPREADSHEET_ID=<ID of the copied TEST spreadsheet>
   OWNER_EMAIL=<your own email address>
   EMAIL_MODE=DRY_RUN
   ALLOW_PRODUCTION_EMAILS=false
   ENABLE_PAYMENT_IMPORT=false
   ```

4. Upload the tested source to **DEV only**:

   ```powershell
   npm run dev:status
   npm run dev:push
   ```

   `dev:push` checks that the clasp ID matches the local DEV marker and that
   `rootDir` is `src`, runs the complete test suite, then invokes `clasp push`.
   It does **not** create a web-app deployment or enable triggers.
5. In the Apps Script editor, run `previewPaymentReminders()` manually. This
   previews reminder statuses without sending emails or writing the sheet.
   To send a test email to **your inbox only**, switch `EMAIL_MODE` to `TEST`
   and manually run `checkCellFillColor()`. TEST mode does send emails to
   `OWNER_EMAIL`, so leave `DRY_RUN` enabled when that is unwanted.

### Link your existing DEV Apps Script project (no new project needed)

If you already have a separate DEV Apps Script project and a separate test
spreadsheet, **use this instead of `npm run dev:create`**:

1. In your **existing DEV Apps Script** editor, open **Project Settings** and
   copy the **Script ID** (not the spreadsheet ID). Confirm it differs from
   the production script's ID.
2. In DEV **Project Settings → Script Properties**, set
   `SPREADSHEET_ID` to your test spreadsheet, `OWNER_EMAIL` to your inbox,
   `EMAIL_MODE=DRY_RUN`, `ALLOW_PRODUCTION_EMAILS=false` and
   `ENABLE_PAYMENT_IMPORT=false`. Confirm no live time-based triggers are
   configured on this DEV project.
3. From the repository root in VS Code, run:

   ```powershell
   npm run dev:link
   ```

   Paste the **DEV Script ID** into the terminal prompt, check the project and
   spreadsheet IDs in Google, then type `LINK DEV` to confirm. The helper
   creates ignored local `.clasp.json` and `.clasp-dev.json` files, **without
   uploading anything**. If `.clasp.json` already exists for that same DEV
   script it is preserved; mismatching or previously registered links are
   rejected.
4. Run `npm run dev:status`, double-check the DEV Script ID inside
   `.clasp.json` against Google, then run `npm run dev:push`. This executes
   the local tests before uploading to the registered project.

**Safety limit:** The tool cannot verify from a Google Script ID that the
project is actually DEV or that its Script Properties point to a test sheet.
The `LINK DEV` confirmation is your explicit acknowledgement after checking
in Google's editor. `npm run dev:push` changes the connected Apps Script code,
so do not use the original production Script ID.

**Protection limits:** A manual `clasp push` bypasses the helper, and the helper
cannot verify the contents of your Google Sheet or read Google Script Properties.
Never replace the generated DEV script ID with your production ID. If you already
have an unrelated `.clasp.json` locally, use a separate clean checkout for DEV.
Production release still requires checking real payment history, legacy triggers,
and redacted payment notification subjects. Do not enable real participant sending
until those are checked.

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
