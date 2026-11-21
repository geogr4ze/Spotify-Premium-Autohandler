# Production cutover: Spotify Premium Autohandler

This is a manual, audited cutover for an **existing real Google Sheet and existing Apps Script project**. GitHub merges do not upload code. No `clasp` command is executed automatically by this repository.

**Do not use `npm run dev:push` for production.** It intentionally requires a DEV marker and is not designed for a live script.

## 1. Preserve the current production state

1. Make a copy of the real Google Sheet (including the `Tracker` and `Emails` tabs).
2. Record the existing real Apps Script **Script ID** from Project Settings. This is not the spreadsheet ID. Keep it private.
3. Back up the existing Apps Script source in a separate, empty folder using the same Google account:

   ```powershell
   mkdir "$HOME\spotify-appscript-original-backup"
   cd "$HOME\spotify-appscript-original-backup"
   clasp.cmd clone-script "YOUR_EXISTING_PRODUCTION_SCRIPT_ID"
   ```

4. In the **real Apps Script project**, open **Triggers** and disable/delete the prior scheduled triggers before uploading. Review other users' triggers if applicable. Confirm that no other copies of an older script remain scheduled against the same sheet.
5. In the real Apps Script Project Settings → Script properties, set:

   ```text
   SPREADSHEET_ID=<the REAL Google Sheet ID>
   OWNER_EMAIL=<your own address>
   EMAIL_MODE=DRY_RUN
   ALLOW_PRODUCTION_EMAILS=false
   ENABLE_PAYMENT_IMPORT=false
   ```

   Confirm the real spreadsheet is the intended one, **not** the DEV test sheet.

## 2. Audit the actual real data

- `Tracker!B4:F4`: real join dates; `B5:F5`: names; `B6:F6`: `SUMIF` formulas for **cumulative amounts since joining**; `B9:F9`: actual member emails.
- `Emails!C:C` sender names must match Tracker participant names; `Emails!D:D` must hold numeric payment amounts. **All historical payments** must be represented, otherwise the new script can replace end dates with old ones based on incomplete totals.
- Check the complete rate history in `Tracker!A16:A` (effective dates) and `C16:C` (member's share) with no blank rows within the table. The earliest listed price is assumed for all earlier periods.
- Compare a few existing row-7/row-8 values to independently expected dates and prepaid credit.
- In Gmail, check the `Spotify Premium Money` label. Only authentic payment receipt messages should be present. The current parser reads a subject containing `received`, `from NAME and`, and a dollar amount. **It does not authenticate the sender.**
- Check older unread messages against existing `Emails` records: legacy payment rows without Gmail message IDs can be imported a second time. Resolve historical duplicates manually before the next stage.

## 3. Upload in a fresh production checkout

Do **not** edit the existing DEV `.clasp.json` and do not copy the DEV marker. On your PC, make a **new folder** for the real script:

```powershell
git clone https://github.com/geogr4ze/Spotify-Premium-Autohandler.git spotify-autohandler-production
cd spotify-autohandler-production
git pull
npm.cmd test
```

After checking the Script ID again in the **real** Apps Script Project Settings, create a local, git-ignored clasp configuration in this new folder:

```powershell
'{"scriptId":"YOUR_EXISTING_PRODUCTION_SCRIPT_ID","rootDir":"./src"}' | Set-Content .clasp.json
Get-Content .clasp.json
clasp.cmd status
```

**Stop if the Script ID does not match the real production project.** The repo's `src/` folder will replace the source code in that project:

```powershell
clasp.cmd push
```

This is a code upload, not a web-app deployment. It does not create a trigger. Never execute `clasp.cmd pull` in this source folder as that would replace the checked-out files with remote code.

## 4. Reconcile the live spreadsheet without sending mail

Keep `EMAIL_MODE=DRY_RUN` and `ALLOW_PRODUCTION_EMAILS=false`.

1. Run `testUpdateParticipants()` from the **real** Apps Script project. It is read-only. Compare its calculated dates and balances with the expected real historical records. The report's `calculatedEndDate` is the **next billing date**; Tracker row 7 is the **day before** that date.
2. After checking all unread labeled Gmail messages and reconciling any legacy duplicates, set **only** `ENABLE_PAYMENT_IMPORT=true`. Run the new `importPaymentsForReview()` function **once**. This function writes recognized Gmail messages to the `Emails` tab and **marks those imported messages read**, but does not send mail or update rows 7–8. Unrecognized messages remain unread. Review the execution log and real `Emails` tab. Set `ENABLE_PAYMENT_IMPORT=false` again after review.
3. Verify that Google Sheets recalculated the `SUMIF` totals in Tracker row 6. Run `testUpdateParticipants()` again to confirm every date, prepaid credit and cumulative total.
4. Only if the values are correct, run `updateTrackerValues()` while still in DRY_RUN. It **writes** real Tracker rows 7 and 8, including resetting dates for members with $0 paid.
5. Run `previewPaymentReminders()`; it previews the actual reminder selection based on the updated totals, with no sends or Gmail imports.

**Stop if any member appears unexpectedly overdue or the rate/date calculation does not match your records.**

## 5. Test the real recipients without contacting them

- Change `EMAIL_MODE=TEST` while keeping `ALLOW_PRODUCTION_EMAILS=false` and `ENABLE_PAYMENT_IMPORT=false`.
- Run `checkCellFillColor()` manually. It will send reminder messages **only to OWNER_EMAIL**, not the recipient addresses stored in Tracker. Check formatting, amounts, dates, names and every intended recipient.
- When satisfied, switch back to `EMAIL_MODE=DRY_RUN` until you are ready to enable live delivery.

## 6. Enable production only after reconciliation

After **all** the checks above pass:

```text
SPREADSHEET_ID=<REAL sheet ID>
OWNER_EMAIL=<your own email>
EMAIL_MODE=PRODUCTION
ALLOW_PRODUCTION_EMAILS=true
ENABLE_PAYMENT_IMPORT=true
```

**Caution:** The first `checkCellFillColor()` run can immediately send emails to all members considered due or overdue. The email deduplication marker cannot infer reminders sent by the old script. Confirm the real `Tracker!B9:F9` addresses before running it.

Run `checkCellFillColor()` manually once, inspect Apps Script's **Executions** log and your sheet, then add **one** time-driven trigger for `checkCellFillColor` (for example, daily in your desired time window). Do not leave old triggers active.

## Emergency stop / rollback

- Set `EMAIL_MODE=DRY_RUN`, `ALLOW_PRODUCTION_EMAILS=false`, and `ENABLE_PAYMENT_IMPORT=false`.
- Disable the time-driven trigger.
- Restore Apps Script code from the isolated original backup if necessary, and restore the Sheet from its backup if records were changed incorrectly.

## Current implementation limits

- Gmail parsing uses email **subjects**, not a cryptographic proof of bank payment. It is restricted to unread messages under a Gmail label, and may skip real notifications of a different format.
- A legacy message recorded before Gmail-ID tracking may be added twice if left unread.
- The overdue-month logic can be off for join dates near the 29th–31st after a shorter month.
- The price history must include the actual historical member share; older periods before the earliest entry use that earliest rate.

Do not treat a passing Node test suite as validation of the real bank subject format, existing payment records or recipient addresses.
