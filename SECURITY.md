# Security and privacy policy

This is a **public source-code repository** for a tracker that processes private
Google Sheets and Gmail data. The code is public; **operational records are not**.

## What must never be committed

- Actual member names, private email addresses, payment dates, balances,
  transfer notifications, billing history, or spreadsheet exports
- Gmail tokens, Apps Script OAuth tokens, API keys, service-account keys,
  passwords, Google authentication files, or local `clasp` credentials
- Real spreadsheet links/IDs, production or DEV Script IDs, or real account
  settings; use [placeholder configuration](docs/script-properties.example.md)
- Unredacted log output, screenshots, backups, CSV/XLSX/PDF files, or archives
  that could expose anyone's data

Store the live records **only in access-restricted Google Sheets/Gmail**, and
the real `SPREADSHEET_ID`, `OWNER_EMAIL`, and mode flags in the relevant
**Google Apps Script Script Properties**. Restrict spreadsheet sharing and
App Script project access to people who need it. Do not expose a public web
app or endpoint with access to these records.

## Developer checks (run before pushing)

```powershell
npm.cmd run security:scan
npm.cmd test
```

Install an optional Git **pre-commit** check on each development machine:

```powershell
npm.cmd run security:install-hook
```

The hook inspects **staged content** and refuses commits with potential private
data. It will not overwrite an existing pre-commit hook: integrate
`node scripts/check-public-safety.mjs --staged` manually if you already have one.

The CI workflow runs the public-data check and Node tests for PRs and changes
to `main`. A separate Gitleaks v3 workflow checks for likely credentials in
PRs, updates to `main` and on a weekly schedule. Secret matches and personal
addresses must not be printed in public PR comments; the Gitleaks workflow
disables automated public comments and diagnostic artifacts.

### GitHub repository security settings (maintainer action)

In **Settings → Advanced Security** (names vary), confirm that **Secret
scanning** and **Push protection** are enabled. Add a repository ruleset or
branch protection requiring review and successful privacy/test and Gitleaks
checks before merging into `main`. These settings cannot be enabled merely
by committing workflow files; maintainers must confirm them in GitHub.

These checks are **defense in depth, not a privacy guarantee**. Regex checks
can miss unusual formats and cannot prove that a screenshot or synthetic test
never includes identifiable information. Review every PR for inadvertent data
disclosure; use synthetic values for demonstrations.

## Reporting possible leaks

**Do not open a public issue or paste an exposed value into a PR.** If GitHub
private vulnerability reporting is enabled, use that. Otherwise contact the
repository owner privately through their GitHub profile/contact method. Do not
include other participants' details in public posts.

If an actual secret has appeared in a public commit:
1. Revoke or rotate the credential at its provider immediately, and inspect
   accounts/logs for unexpected access.
2. Stop any automated production operation that may be affected until access
   and permissions have been checked.
3. Review the **entire public Git history**, tags, forks, release archives,
   and PR patches; deleting a file from the latest commit **does not** erase
   older copies. Coordinate history rewriting with all collaborators if needed,
   and remember external copies may persist.
4. If someone else's personal data was published, contact the affected
   individuals privately and follow applicable organizational/legal privacy
   obligations; don't spread the details in public issue threads.
5. Check that Google Sheet sharing, Apps Script account permissions, triggers,
   and GitHub repository secrets are restricted appropriately.

A historic hard-coded email address is a **privacy exposure** even if it
is not an access token; changing the GitHub visibility or adding `.gitignore`
does not undo its previous publication.
