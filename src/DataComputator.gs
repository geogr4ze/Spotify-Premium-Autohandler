function updateParticipants() {
  // Participant columns B:F
  const FIRST_COL = 2;
  const LAST_COL = 6;

  // Rate table rows
  const rateData = trackerSheet.getRange("A16:C17").getValues();

  const rates = rateData
    .filter(r => r[0] && r[2])
    .map(r => ({
      startDate: new Date(r[0]),
      chargeRate: Number(r[2])
    }))
    .sort((a, b) => a.startDate - b.startDate);

  for (let col = FIRST_COL; col <= LAST_COL; col++) {

    const joinDate = trackerSheet.getRange(4, col).getValue();
    const amountPaid = Number(trackerSheet.getRange(6, col).getValue());

    if (!joinDate || !amountPaid) continue;

    let balance = amountPaid;
    let currentDate = new Date(joinDate);

    for (let i = 0; i < rates.length; i++) {

      const currentRate = rates[i].chargeRate;

      const nextRateDate =
        i < rates.length - 1
          ? rates[i + 1].startDate
          : null;

      if (nextRateDate && currentDate < nextRateDate) {

        const monthsUntilNextRate =
          (nextRateDate.getFullYear() - currentDate.getFullYear()) * 12 +
          (nextRateDate.getMonth() - currentDate.getMonth());

        const costUntilNextRate =
          monthsUntilNextRate * currentRate;

        if (balance < costUntilNextRate) {

          const balanceCents = Math.round(balance * 100);
          const rateCents = Math.round(currentRate * 100);

          const fullMonths = Math.floor(balanceCents / rateCents);
          const leftoverCents = balanceCents % rateCents;

          currentDate.setMonth(
            currentDate.getMonth() + fullMonths
          );

          trackerSheet.getRange(7, col).setValue(currentDate);

          trackerSheet.getRange(8, col).setValue(
            leftoverCents > 0
              ? "$" + (leftoverCents / 100).toFixed(2)
              : "NONE"
          );

          balance = 0;
          break;
        }

        balance -= costUntilNextRate;
        currentDate = new Date(nextRateDate);

      } else {

        const balanceCents = Math.round(balance * 100);
        const rateCents = Math.round(currentRate * 100);

        const fullMonths = Math.floor(balanceCents / rateCents);
        const leftoverCents = balanceCents % rateCents;

        currentDate.setMonth(
          currentDate.getMonth() + fullMonths
        );

        trackerSheet.getRange(7, col).setValue(currentDate);

        trackerSheet.getRange(8, col).setValue(
          leftoverCents > 0
            ? "$" + (leftoverCents / 100).toFixed(2)
            : "NONE"
        );

        balance = 0;
        break;
      }
    }
  }
}