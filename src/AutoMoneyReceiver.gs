const labelName = 'Spotify Premium Money';
const nameFinder = '=MID(A2, SEARCH("from", A2) + 5, SEARCH("and", A2) - (SEARCH("from", A2) + 6))';
const amountFinder = '=VALUE(MID(A2, 37, SEARCH("received", A2) - 23))';

//Data reader and translate from email to google sheets
function addData() {
  const label = GmailApp.getUserLabelByName(labelName);
  const threads = label.getThreads();
  for (let i = 0; i < threads.length; i++) {
    const message = threads[i].getMessages();
    if (message[0].isUnread()) {
      emailSheet.insertRows(2, 1);
      let subject = message[0].getSubject();
      let date = message[0].getDate();
      var newRowData = [subject, date, nameFinder, amountFinder];

      emailSheet.getRange(2, 1, 1, newRowData.length).setValues([newRowData]);
      
      Gmail.Users.Messages.modify({
        'removeLabelIds': ['STARRED']
      }, 'me', message[0].getId());
      message[0].markRead();
      updateParticipants()
    }
  } 
}
