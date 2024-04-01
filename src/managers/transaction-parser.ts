import * as ynab from "ynab";
import {FullTransaction} from "./amazon-manager";


export const parseTransactions = (options: {
  ynabAmazonTransactions: ynab.TransactionDetail[],
  amazonTransactions: FullTransaction[]
}) => {
  const toUpdate: ynab.SaveTransactionWithId[] = [];

  // For now, just match it up by amount. TODO: Make this more robust, e.g. by resolving duplicates by date.
  const amazonTransactionsMap = new Map(options.amazonTransactions.map((a) => [a.priceInCents, a]));

  for (const ynabAmazonTransaction of options.ynabAmazonTransactions) {
    // Lookup by amount (divide by 10 to convert from milliunits - https://api.ynab.com/#formats).
    const amazonTransaction = amazonTransactionsMap.get(ynabAmazonTransaction.amount / 10);

    if (!amazonTransaction) {
      console.warn(`Could not find amazon Transaction for YNAB transaction ${JSON.stringify(ynabAmazonTransaction)}`);
      continue;
    }

    let memo = amazonTransaction.itemNames.join('; ');
    // YNAB has a maximum memo length of 200 characters.
    if (memo.length > 200) {
      memo = memo.slice(0, 200);
    }

    ynabAmazonTransaction.memo = memo;
    toUpdate.push(ynabAmazonTransaction);
  }

  return toUpdate;
}