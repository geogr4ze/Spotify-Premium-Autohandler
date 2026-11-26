# Development standards

- Preserve payment calculations, date handling, recipient selection, and
  development/production separation. Test using the development project.
- Document every named function, method, constructor and helper with JSDoc.
  Include parameters, preconditions, returns/postconditions, effects, and errors
  where relevant. Update documentation whenever implementation changes.
- Aim for 80–100 characters per line; avoid exceeding 120 except for unavoidable
  literals or generated data. Break complex expressions into readable lines.
- Use descriptive names, consistent indentation, cohesive functions, and
  comments that explain why. Avoid unnecessary nesting and compressed one-liners.
- Keep private sheet/script IDs, participant information and credentials outside
  version control. Never redirect development emails to real members.
- Run local tests and inspect diffs before pushing to Apps Script. Do not deploy
  to production or send real reminders as part of a formatting change.
- Report any test or verification limitations.
