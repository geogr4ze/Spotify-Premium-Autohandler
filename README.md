# Spotify Premium Autohandler

## What is this project?

Spotify Premium Autohandler is a personal payment-tracking and reminder system for a **six-person Spotify Premium plan** that I share with five other people. I manage the subscription and collect each member's share, so the project helps me keep track of who has paid, how much they have contributed, and when their next payment is due.

It uses **Google Apps Script, Google Sheets, and Gmail** to bring payment records, billing calculations, and reminder emails into one workflow. It tracks contributions and sends reminders; it does **not** charge members automatically or manage the Spotify subscription itself.

## Why I made it

I originally kept track of everyone's contributions by checking payment notification emails, updating a spreadsheet, and figuring out how long each person's payments would cover their subscription. Doing this for five other people every month became repetitive, and it was easy to lose track of payments, overdue balances, or prepaid months.

I wanted a system that would reduce manual work, keep a clear history of contributions, and make payment reminders more consistent. I also wanted it to handle subscription price changes without treating every past month as though it had always cost the current price. This project was an opportunity to automate a real task I was already managing while developing my skills with JavaScript, Google Apps Script, spreadsheets, and testing.

## How it works

The project follows this workflow:

```text
Labeled Gmail payment notifications
             |
             v
     Google Sheets: Emails tab
       (payment history)
             |
             v
     Google Sheets: Tracker tab
    (member totals and join dates)
             |
             v
  Apps Script billing calculations
  (dated prices, paid-through dates,
        unused prepaid credit)
             |
             v
  Payment reminders and owner alerts
```

1. **Record payments.** Payment notifications matching the expected format are read from the Gmail label `Spotify Premium Money` and recorded in the `Emails` sheet, including the sender, amount, date, and Gmail message ID. Importing is opt-in, and recorded message IDs help prevent duplicate imports. Unrecognized emails are left alone.
2. **Track each member's contributions.** The `Tracker` sheet stores each person's join date, name, cumulative amount paid, paid-through date, prepaid credit, and email address. Spreadsheet formulas can sum the payment amounts in the `Emails` sheet by member name.
3. **Calculate subscription coverage.** The script works through each member's monthly billing dates, using the price in effect for each period. This allows it to account for historical price changes and calculate the last day covered by their payments, along with any unused credit.
4. **Prepare reminders.** Members who owe money can receive a personalized email with the calculated amount due. When someone is at least two full calendar months overdue, the owner can also receive an alert. Successful production reminders are tracked to avoid repeatedly sending the same reminder for the same billing period.
5. **Run safely.** A scheduled Apps Script function, `checkCellFillColor()`, coordinates the workflow. `DRY_RUN` does not send emails or modify Gmail or Sheets through this scheduled entry point; `TEST` routes reminder emails to my inbox only; and `PRODUCTION` requires explicit authorization for live sending and a separate opt-in for payment import.

The project includes automated local tests and development safeguards to help catch problems before changes reach the live payment workflow.

## Technologies used

- **Google Apps Script / JavaScript:** payment parsing, date and price calculations, reminders, and automation
- **Google Sheets:** payment history, member records, formulas, and billing-rate history
- **Gmail:** reading trusted payment notifications and sending reminder emails
- **Node.js and VS Code:** local tests and development

## Project status

The application has been tested locally using mocked Google services. Its integration with live Gmail notifications and the real tracking spreadsheet still requires verification.
