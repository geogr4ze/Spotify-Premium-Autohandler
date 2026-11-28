# Example Script Properties (placeholders only)

Configure these in **Google Apps Script → Project Settings → Script properties**.
They are **not loaded from this Markdown file**. Never put real account identifiers
or payment data in this public repository.

| Property | Public documentation value | Real value belongs in |
| --- | --- | --- |
| `SPREADSHEET_ID` | `<YOUR_PRIVATE_SHEET_ID>` | The individual DEV or production Apps Script project's Script Properties |
| `OWNER_EMAIL` | `owner@example.com` | That project's Script Properties |
| `EMAIL_MODE` | `DRY_RUN` | That project's Script Properties |
| `ALLOW_PRODUCTION_EMAILS` | `false` | That project's Script Properties |
| `ENABLE_PAYMENT_IMPORT` | `false` | That project's Script Properties |

**DEV** should point to a separate test Sheet, with fictional members and
non-real recipients. **PRODUCTION** should point to the real restricted-access
Sheet. Do not make the Sheet publicly accessible or publish a CSV export.

The Google account *executing* a function or owning a trigger decides which
Gmail mailbox `GmailApp` reads. Changing `OWNER_EMAIL` does not change
that account. Configure and authorize the trigger under the intended Google
account.

The local files `.clasp.json`, `.clasp-dev.json`, `.clasp-prod.json`,
and `.clasprc.json` are ignored by Git and must never be copied into issues,
screenshots or pull requests. Script IDs are not OAuth credentials, but should
still be kept out of this public repository.

Before enabling live notifications, verify the real Sheet's historical
records, rate table, unread payment notification label, and recipient addresses.
Run only the read-only preview functions until the results are correct.
