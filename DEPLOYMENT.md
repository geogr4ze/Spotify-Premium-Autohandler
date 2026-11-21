# Deploy to DEV or PRODUCTION from the same VS Code checkout

You can safely use **one GitHub checkout** on your laptop or PC to upload the
same `src/` code to either Apps Script project. The local target configurations
are independent and ignored by Git.

| Target | One-time setup | Check connection | Upload |
| --- | --- | --- | --- |
| DEV test project | `npm.cmd run dev:link` if not linked | `npm.cmd run dev:status` | `npm.cmd run deploy:dev` |
| Existing real project | `npm.cmd run deploy:prod:link` | `npm.cmd run deploy:prod:status` | `npm.cmd run deploy:prod` |

If you also merge the earlier production preflight PR (#10), use this guide's\n**same-checkout commands** instead of the separate-folder upload method in\nits cutover checklist. Its payment reconciliation and live-email checks still apply.\n\n**There is no default production target.** Production requires a separately
registered Script ID and an interactive confirmation on every upload. Existing
`dev:push`, `dev:status`, `dev:link` and `dev:create` commands continue to work.

## First-time setup on each computer

1. Install and sign in to `clasp` for the Google account that owns both scripts:

   ```powershell
   npm.cmd install -g @google/clasp
   clasp.cmd login
   ```

2. Clone the repo or update the local checkout:

   ```powershell
   git checkout main
   git pull
   npm.cmd test
   ```

3. For DEV, if your PC does not have the local `.clasp.json` and
   `.clasp-dev.json` files, run:

   ```powershell
   npm.cmd run dev:link
   ```

   Use the **existing DEV Script ID** from Google Apps Script → Project
   Settings. Do not create another project if the DEV project already exists.

4. For production, back up the **real Sheet and original Apps Script source**,
   then run **once per PC**:

   ```powershell
   npm.cmd run deploy:prod:link
   ```

   Paste the **existing REAL production Script ID** from that project's
   Project Settings, compare it with the DEV Script ID, then type the requested
   confirmation. This saves a separate, ignored `.clasp-prod.json` locally.
   It does **not** upload code or change your Google Sheet.

   Do not paste either ID into source files, GitHub issues, or pull requests.

## Everyday deployment

### Upload to DEV

```powershell
git checkout main
git pull
npm.cmd run dev:status
npm.cmd run deploy:dev
```

This reuses the existing, validated DEV clasp setup and runs the Node tests.

### Upload to PRODUCTION

**Before every production upload**:

- Back up your real spreadsheet and current Apps Script code.
- In the **real Apps Script project**, review and disable existing scheduled
  triggers that should not be running during code replacement.
- In real **Project Settings → Script properties**, verify:

  ```text
  SPREADSHEET_ID=<REAL sheet ID>
  OWNER_EMAIL=<your real email address>
  EMAIL_MODE=DRY_RUN
  ALLOW_PRODUCTION_EMAILS=false
  ENABLE_PAYMENT_IMPORT=false
  ```

  This is a pre-upload safety state. **Uploading code does not update these
  Script Properties**. Existing triggers can run new code immediately.

- Check that historical payments in real `Emails` data, `SUMIF` totals in
  Tracker row 6, rate history, and recipient addresses are correct.
  Reconcile unread labeled Gmail notifications to avoid importing legacy
  payments a second time.

Then from the **same checkout**:

```powershell
git checkout main
git pull
npm.cmd run deploy:prod:status
npm.cmd run deploy:prod
```

The production command:

1. Verifies that production and DEV Script IDs differ.
2. Runs the complete Node test suite.
3. Copies **only the `src/` directory** into a temporary folder and writes a
   temporary production `.clasp.json` there.
4. Shows `clasp status` for the production target.
5. Requires a typed `DEPLOY PRODUCTION <last 6 characters>` confirmation.
6. Runs `clasp push` against **only** the production Script ID.
7. Deletes the temporary folder; your original DEV link is unchanged.

This **uploads code only**. It does **not** authorize production email
delivery, modify the real spreadsheet, turn on Gmail imports, or configure
scheduled triggers. Those depend on the existing Script Properties and triggers
in the actual Google Apps Script project.

## After uploading to the real script

1. Keep `EMAIL_MODE=DRY_RUN`. Run `testUpdateParticipants()` and compare
   every calculated date and credit with actual historical records; then run
   `previewPaymentReminders()` to inspect who would receive reminders.
2. **If merged and available:** `importPaymentsForReview()` allows a separate
   import-only reconciliation under `DRY_RUN` with
   `ENABLE_PAYMENT_IMPORT=true`. It writes the Emails sheet and marks
   imported messages read; first check for duplicate legacy emails.
3. If amounts are correct, `updateTrackerValues()` in DRY_RUN explicitly
   writes rows 7 and 8. **A member with $0 total paid is reset to the day before
   their join date**, even if row 7 previously held a later date.
4. Set `EMAIL_MODE=TEST` (with `ALLOW_PRODUCTION_EMAILS=false`) to review
   emails sent **to OWNER_EMAIL only** via `checkCellFillColor()`.
5. Only when the real balances, recipients and messages are confirmed,
   explicitly enable `EMAIL_MODE=PRODUCTION`,
   `ALLOW_PRODUCTION_EMAILS=true`, and
   `ENABLE_PAYMENT_IMPORT=true`. The first run of
   `checkCellFillColor()` can send live reminders immediately. Install **one**
   time-driven trigger after the manual run is reviewed.

The new uploader **does not make the production business logic safe by itself**.
The Gmail parser expects a particular bank notification subject format, older
payment records can lack message-ID deduplication, and month-end overdue counts
need checking for join dates around the 29th–31st.

## Troubleshooting

- **Production not linked:** run `npm.cmd run deploy:prod:link`.
- **Clasp not recognized:** install `@google/clasp` globally and reopen the
  VS Code terminal; on Windows use `clasp.cmd login`.
- **DEV marker missing:** use `npm.cmd run dev:link` against the real DEV
  Script ID; never substitute the production ID.
- **Target confusion:** compare the displayed Script ID with the one in the
  corresponding Google Apps Script → Project Settings. The CLI cannot
  independently know which Google project or Sheet is production.
- **Switching PCs:** copy or recreate the ignored local links *on that PC*;
  GitHub intentionally never stores them.

Never run `clasp push` directly from an unverified working directory. Use
`deploy:dev` or `deploy:prod` instead.
