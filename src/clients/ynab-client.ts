import * as ynab from "ynab";
import * as statusAnd from "../utils/statusAnd";
import {DateTime} from "luxon"

export class YnabClient {
  private accessToken: string;
  private client: ynab.API

  constructor(token: string) {
    this.accessToken = token;
    this.client = new ynab.API(token);
  }

  async getBudgets() {
    const response = await this.client.budgets.getBudgets();
    const budgets = response.data.budgets;

    if (!budgets.length) {
      throw statusAnd.error('API call to get budgets was successful, but returned 0 budgets!');
    }
    return budgets;
  }

  async getMostRecentBudget() {
    const budgets = await this.getBudgets();

    return budgets.sort((a, b) => {
      if (!a.last_modified_on && !b.last_modified_on) {
        return 0;
      }
      if (!b.last_modified_on) {
        return new Date(a.last_modified_on!).getTime();
      }
      if (!a.last_modified_on) {
        return new Date(b.last_modified_on!).getTime();
      }
      return new Date(b.last_modified_on).getTime() - new Date(a.last_modified_on).getTime()
    })[0];
  }

  async getUnapprovedTransactions(options: { budgetId: string, limitDays?: number }) {
    const transactions = await this.client.transactions.getTransactionsByType(options.budgetId, 'unapproved').then(r => r.data.transactions);
    if (options.limitDays) {
      return transactions.filter(t => DateTime.fromISO(t.date).diffNow('days').days >= -(options.limitDays!))
    }
    return transactions;
  }

  async getUncategorizedTransactions(options: { budgetId: string, limitDays?: number }) {
    const transactions = await this.client.transactions.getTransactionsByType(options.budgetId, 'uncategorized').then(r => r.data.transactions);
    if (options.limitDays) {
      return transactions.filter(t => DateTime.fromISO(t.date).diffNow('days').days >= -(options.limitDays!))
    }
    return transactions;
  }

  async getApplicableTransactions(options: { budgetId: string, limitDays?: number }) {
    const unapprovedTransactions = await this.getUnapprovedTransactions(options);
    const uncategorizedTransactions = await this.getUncategorizedTransactions(options);
    return [...unapprovedTransactions, ...uncategorizedTransactions];
  }

  async updateTransactions(options: {
    budgetId: string,
    transactions: ynab.SaveTransactionWithId[],
    ignoreWithMemo?: boolean
  }) {
    let transactions: ynab.SaveTransactionWithId[] = options.transactions;
    if (options.ignoreWithMemo) {
      transactions = transactions.filter((t) => !t.memo?.length);
    }

    await this.client.transactions.updateTransactions(options.budgetId, {transactions});
  }
}
