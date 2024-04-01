import * as statusAnd from "../../utils/statusAnd";
import {YnabClient} from "../../clients/ynab-client";
import {BudgetSummary} from "ynab";

export class YnabManager {
  async getYnabTransactions(options: { ynabClient: YnabClient, maxOrders: number, budget: BudgetSummary }) {
    const ynabTransactions = await options.ynabClient.getApplicableTransactions({budgetId: options.budget.id, limitDays: 60});

    if (!ynabTransactions.length) {
      throw statusAnd.error(`Found no Amazon YNAB transactions found.`)
    }

    const ynabAmazonTransactions = ynabTransactions.filter((t) => t.payee_name?.includes('Amazon'));
    if (!ynabAmazonTransactions.length) {
      throw statusAnd.error(`No uncleared or uncategorized Amazon transactions found in YNAB`)
    }
    return ynabAmazonTransactions
  }
}

