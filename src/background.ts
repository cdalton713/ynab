import * as statusAnd from "./utils/statusAnd";
import {YnabClient} from "./clients/ynab-client";
import {YnabManager} from "./managers/ynab-manager";
import {parseTransactions} from "./managers/transaction-parser";
import {AmazonManager} from "./managers/amazon-manager";


chrome.runtime.onMessage.addListener(async (request: {
  numOrders?: number,
  ynabAccessToken: string
}, sender: chrome.runtime.MessageSender, _sendResponse: (v: any) => void): Promise<void> => {
  const amazonManager = new AmazonManager();
  const ynabManager = new YnabManager()

  try {
    const maxOrders = request.numOrders || 50;

    const ynabClient = new YnabClient(request.ynabAccessToken);


    const amazonTransactions = await amazonManager.getFullAmazonTransactions({maxOrders})

    const budget = await ynabClient.getMostRecentBudget();
    const ynabAmazonTransactions = await ynabManager.getYnabTransactions({
      ynabClient,
      maxOrders,
      budget
    });

    const parsedTransactions = parseTransactions({amazonTransactions, ynabAmazonTransactions})
    await ynabClient.updateTransactions({
      transactions: parsedTransactions,
      budgetId: budget.id,
      ignoreWithMemo: true
    })

    await chrome.runtime.sendMessage(statusAnd.ready(`Successfully updated ${parsedTransactions.length} transaction(s)!`));
  } catch (e: any) {
    if (statusAnd.isError(e)) {
      await chrome.runtime.sendMessage(e);
    }
  }
});