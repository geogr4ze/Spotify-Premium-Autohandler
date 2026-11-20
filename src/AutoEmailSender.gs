// Function that send an email who needs to pay for this months spotify plan
function mail(email, emailhtml) {
  GmailApp.sendEmail(
    email,
    'Spotify Premium Payment Reminder',
    'This email contains html',
    {htmlBody: emailhtml}
  )
}

// Function to compile all the data for the email.
function compilerRegularEmail(count) {
  let htmlTemplate = HtmlService.createTemplateFromFile('Email');

  htmlTemplate.rate = rate;
  htmlTemplate.name = part[count].name;
  htmlTemplate.date = part[count].endDate;
  
  let htmlForEmail = htmlTemplate.evaluate().getContent();
  mail(part[count].email, htmlForEmail);
}

function compilerOverBalanceEmail(count) {
  let htmlTemplate = HtmlService.createTemplateFromFile('OverBalanceEmail');

  htmlTemplate.rate = rate;
  htmlTemplate.overbalance = rate - part[count].overdueAmt;
  htmlTemplate.name = part[count].name;
  htmlTemplate.date = part[count].endDate;
  
  let htmlForEmail = htmlTemplate.evaluate().getContent();
  mail(part[count].email, htmlForEmail);
}

// Function send an email to tell me who has overdue payments
function informMail(emailhtml) {
  GmailApp.sendEmail(
    mchen,
    'Spotify Premium Participant Payment Overdue',
    'This email contains html',
    {htmlBody: emailhtml}
  )
}

//Compiles informer message 
function informCompiler(count, overdueMonths) {
  let htmlTemplate = HtmlService.createTemplateFromFile('ManyuEmail');

  htmlTemplate.months = overdueMonths;
  htmlTemplate.moneyOwed = part[count].overdueAmt;
  htmlTemplate.name = part[count].name;
  htmlTemplate.date = part[count].endDate;
  
  let htmlForEmail = htmlTemplate.evaluate().getContent();
  informMail(htmlForEmail);
}

// Function the undate the data in the apps script
function updateSheetData() {
  updateParticipants()
  for (let partNum = 0; partNum < numPart; partNum++) {
    part[partNum] = new participant(values[0][partNum], values[1][partNum], values[2][partNum], values[3][partNum], values[4][partNum]);
  }
  for (let c = 0; c < numPart; c++) {
    part[c].colour = trackerSheet.getRange(String.fromCharCode('D'.charCodeAt(0) + c) + '7').getBackground();
  }
}

// Function to inform me when someone has not paid for 2 months
function informer() {
  for (let i = 0; i < numPart; i++) {
    if (part[i].overdueAmt != "NONE") {
      let removedSymbol = part[i].overdueAmt.replace(/[^0-9.-]/g, '');
      let numRate = rate.replace(/[^0-9.-]/g, '');
      
      let months = (parseFloat(removedSymbol)) / parseFloat(numRate);
      if (months >= 2) {
        informCompiler(i, months);
      }
    }
  }
}

//Full data update and decision function
function checkCellFillColor() {
  console.log(rate);
  addData();
  updateSheetData();
  informer();
  for(let i = 0; i < numPart; i++) {
    if ((part[i].colour === "#f4c7c3") || (part[i].colour === "#fce8b2")) {
      if ((part[i].overdueAmt < rate) && (part[i].overdueAmt > 0)) {
        compilerOverBalanceEmail(i);
      } else {
        compilerRegularEmail(i);
      }
      
    }
  }
}

