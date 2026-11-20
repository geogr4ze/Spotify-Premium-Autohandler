// Google Sheets Reference
const gsID = '1sfUdBfjzDz7BY_iwCxnAkmPsiBNZJQnyhZ_doYJo7c4';
const gs = SpreadsheetApp.openById(gsID);
const trackerSheet = gs.getSheetByName('Tracker');
const testSheet = gs.getSheetByName('Testing Sheet')
const emailSheet = gs.getSheetByName('Emails');

// Rate
const rate = trackerSheet.getRange('B13').getDisplayValue();

// The current date
const date = new Date();

// My email
const mchen = 'manyuc2007@gmail.com';

// Data Range
const range = trackerSheet.getRange('B5:F9');
const values = range.getDisplayValues();

// Participant Array
const numPart = 5;
let part1 = new participant();
let part2 = new participant();
let part3 = new participant();
let part4 = new participant();
let part5 = new participant();
const part = [part1, part2, part3, part4, part5];

// Participant Structure
function participant(name, payment, endDate, overdueAmt, email, colour) {
  this.name = name;
  this.payment = payment;
  this.endDate = endDate;
  this.overdueAmt = overdueAmt;
  this.email = email;
  this.colour = colour;
}