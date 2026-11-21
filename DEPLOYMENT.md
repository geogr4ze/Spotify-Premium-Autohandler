# Spotify Premium Autohandler — ongoing deployments

The Spotify payment tracker has already been transitioned to its real Google Apps Script project. This guide covers **updates to the existing DEV and production projects**, not an initial production cutover. Do not create a new production Apps Script project just to deploy an update.

Both targets can be managed from the **same VS Code checkout**. Their Apps Script IDs are kept in separate, git-ignored local files, so switching computers may require linking the existing projects on the new computer.

| Target | Check the connected script | Upload updates |
| --- | --- | --- |
| DEV test project | `npm.cmd run dev:status` | `npm.cmd run deploy:dev` |
| Existing production project | `npm.cmd run deploy:prod:status` | `npm.cmd run deploy:prod` |

**Merging a GitHub pull request does not upload code to Google Apps Script.** The upload commands synchronize the `src/` code only; they do not update Script Properties, alter spreadsheet data directly, or create or remove scheduled triggers. However, an already-running trigger can execute newly uploaded code.

## Update DEV

From the repository root in VS Code:

```powershell
git checkout main
git pull
npm.cmd run dev:status
npm.cmd run deploy:dev
```

This checks the saved DEV target and runs the local Node tests before uploading. Confirm the DEV script points to a separate test spreadsheet, not the live payment records.

## Update production

Before updating the **existing live** Apps Script project:

1. **Back up** the live Google Sheet and current Apps Script source so you can roll back if necessary.
2. Review what changed, including payment parsing, billing calculations, Gmail access and email recipients. Check any relevant data against the real `Tracker` and `Emails` tabs.
3. In the real Apps Script editor, verify that `SPREADSHEET_ID` is the real spreadsheet and `OWNER_EMAIL` is correct. Confirm the production Script ID differs from DEV. Keep IDs and email addresses out of Git.
4. Record the currently active email/import settings. Temporarily disable the scheduled trigger while replacing the code. Set the real project's Script Properties to this **safe pre-upload state**:

   ```text
   EMAIL_MODE=DRY_RUN
   ALLOW_PRODUCTION_EMAILS=false
   ENABLE_PAYMENT_IMPORT=false
   ```

   This prevents the ordinary scheduled payment cycle from sending emails or importing payments during the update. The upload command **does not** set these properties for you.

From the same repository checkout:

```powershell
git checkout main
git pull
npm.cmd run deploy:prod:status
npm.cmd run deploy:prod
```

The production uploader checks the saved production target, runs the Node tests, stages only `src/` in a temporary folder, displays `clasp status`, and requires a typed confirmation before pushing. It does not modify the DEV clasp configuration.

### After the upload

1. While still in `DRY_RUN`, use `testUpdateParticipants()` to inspect recalculated balances and `previewPaymentReminders()` to inspect which reminders would be selected. Both are read-only.
2. Check the actual Tracker totals, historical price schedule, paid-through dates, prepaid credit, payment records and recipient addresses. **Do not send reminders if anything looks incorrect.**
3. If email wording or recipients changed, set `EMAIL_MODE=TEST` with `ALLOW_PRODUCTION_EMAILS=false` and `ENABLE_PAYMENT_IMPORT=false`, then run `checkCellFillColor()` manually. TEST emails go only to `OWNER_EMAIL`. Switch back to `DRY_RUN` afterwards.
4. When satisfied, restore the intended **live** Script Properties. For normal authorized production sending, `EMAIL_MODE=PRODUCTION` and `ALLOW_PRODUCTION_EMAILS=true` are required. Set `ENABLE_PAYMENT_IMPORT=true` only if Gmail ingestion is intended and the labeled notifications have been reviewed.
5. Re-enable the existing time-driven trigger (normally one trigger for `checkCellFillColor()`) if you paused it. Review the Apps Script Executions log and check for unexpected messages or sheet updates.

**Important:** Returning to `PRODUCTION` may send reminders to members on the next scheduled run. Existing deduplication markers prevent repeats for recorded sends, but cannot reconstruct emails sent by older versions of the script.

## Email modes and manual operations

| Mode or function | Behavior |
| --- | --- |
| `EMAIL_MODE=DRY_RUN` | The scheduled `checkCellFillColor()` cycle previews without sending, importing Gmail messages, or writing Tracker values. |
| `EMAIL_MODE=TEST` | Generated reminders are sent to `OWNER_EMAIL` only; no Gmail import or Tracker updates through the scheduled cycle. |
| `EMAIL_MODE=PRODUCTION` | Live reminders require `ALLOW_PRODUCTION_EMAILS=true`. Gmail importing additionally requires `ENABLE_PAYMENT_IMPORT=true`. |
| `importPaymentsForReview()` | **Explicit exception:** can import recognized Gmail messages and mark them read even while in DRY_RUN, but only with `ALLOW_PRODUCTION_EMAILS=false` and `ENABLE_PAYMENT_IMPORT=true`. Does not send reminders or update Tracker rows 7–8. Use only for an intentional, audited reconciliation. |
| `updateTrackerValues()` | Explicit manual function that **writes** recalculated Tracker rows 7–8 under its DRY_RUN guard. A $0 cumulative payment can reset a participant's saved paid-through date. Not required for a routine code upload. |

Never use a generic `clasp push` from an unverified working directory. Use `deploy:dev` or `deploy:prod` instead.

## Switching computers or repairing a local link

The Apps Script projects already exist. The local connection files are deliberately not stored on GitHub.

- If `clasp` is unavailable on a new computer, install `@google/clasp` and sign in with `clasp.cmd login`.
- If the existing DEV connection is missing, run `npm.cmd run dev:link` using the existing DEV Script ID.
- If the existing production connection is missing, run `npm.cmd run deploy:prod:link` using the existing **real production** Script ID. This only saves the local target; it does not upload code.
- Verify each Script ID in Google Apps Script → Project Settings and run its corresponding `status` command before uploading. Never substitute DEV and production IDs.

The production uploader uses an ignored `.clasp-prod.json` profile, separate from the verified DEV `.clasp.json` and `.clasp-dev.json` files.

## Emergency stop and rollback

If a live update behaves unexpectedly, switch the real Script Properties to `EMAIL_MODE=DRY_RUN`, `ALLOW_PRODUCTION_EMAILS=false` and `ENABLE_PAYMENT_IMPORT=false`, then disable the scheduled trigger. Restore the saved Apps Script source and/or spreadsheet backup as appropriate, verify records and recipients, and only then resume automation.

Known limitations remain relevant during ongoing operation: Gmail importing relies on labeled **subject lines** rather than independent proof of payment, old payment rows without message IDs can cause legacy duplicates, and month-end overdue counts around the 29th–31st require extra checking. Passing local tests does not independently verify the live Gmail account, notifications, spreadsheet or triggers.
