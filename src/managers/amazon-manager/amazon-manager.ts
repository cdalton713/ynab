import {DOMParser} from 'linkedom/worker';
import {getActiveTab, getHtml} from "../../utils/utils";
import {FullTransaction, OrderInfo, Transaction} from "./types";
import * as statusAnd from "../../utils/statusAnd"

export class AmazonManager {
  /**
   * Parse all the transactions on the Amazon transactions page, like https://www.amazon.com/cpe/yourpayments/transactions.
   *
   * @param html The HTML to parse.
   * @returns The parsed Transactions.
   */
  parseTransactions(html: string): Transaction[] {
    const parsed = (new DOMParser).parseFromString(html, 'text/html');

    // Extract order information
    const orders: Transaction[] = [];

    // Find all transaction date containers
    const dateContainers = parsed.querySelectorAll(".apx-transaction-date-container");

    dateContainers.forEach((dateContainer: any) => {
      // Get order date
      const orderDateText = dateContainer.querySelector("span")!.textContent!.trim();
      const orderDate = new Date(orderDateText);

      const allOrdersOnDateContainer = dateContainer.nextElementSibling!.querySelectorAll(".apx-transactions-line-item-component-container")!;
      // const allOrdersOnDate = allOrdersOnDateContainer.querySelectorAll(".apx-transactions-line-item-component-container");

      allOrdersOnDateContainer.forEach((order: any) => {
        // Find the following line item container
        // const lineItemContainer = dateContainer.nextElementSibling!.querySelector()!;

        // Extract order details
        const orderNumberElement = order.querySelector("a")!;
        const orderNumber = orderNumberElement.textContent!.trim().replace('Order #', '');
        const priceElement = order.querySelector(".a-text-right span")!;

        const price = priceElement.textContent!.trim();
        // Remove the dollar symbol and decimal point
        const numericString = price.replace(/[^0-9-]/g, '');
        // Multiply by 100 to convert to pennies and ensure an integer
        const price_in_cents = parseInt(numericString, 10);
        const payeeElement = order.querySelectorAll("span")[2];
        if (!payeeElement) {
          // Some transactions don't have payee info, e.g. if you use an Amazon Gift Card elsewhere.
          // Ignore these for now.
          console.warn(`Ignoring transaction ${orderNumber} with no payee information.`);
          return;
        }
        const payee = payeeElement.textContent!.trim();

        // Add extracted information to the orders array
        orders.push({orderNumber, orderDate, priceInCents: price_in_cents, payee});
      });
    });

    console.log(`Amazon Transactions: ${JSON.stringify(orders)}`);
    return orders;
  }

  /** Extract order information from the Orders HTML page. */
  parseOrders(html: string): OrderInfo[] {
    const parsed = (new DOMParser).parseFromString(html, 'text/html');
    // Get all order cards on the page
    const orderCards = parsed.querySelectorAll(".order-card");

    // Initialize an empty array to store order information
    const orders: OrderInfo[] = [];

    // Loop through each order card
    orderCards.forEach((card: any) => {
      // Extract order number
      const orderNumberElement = card.querySelector(".yohtmlc-order-id span:nth-child(2)");
      const orderNumber = orderNumberElement ? orderNumberElement.textContent.trim() : "";

      // Extract item names
      const itemNames: string[] = [];
      const itemElements = card.querySelectorAll(".yohtmlc-product-title");
      itemElements.forEach((item: any) => {
        itemNames.push(item.textContent.trim());
      });

      // Add order information to the array
      orders.push({orderNumber, itemNames});
    });

    // Return the array of order information
    return orders;
  }

  async getOrders(options: { tabId: number, maxOrders: number }) {
    // Next up: Orders page.
    const orders: OrderInfo[] = [];
    let newOrders: OrderInfo[] = [];

    let i = 0;
    do {
      const url = `https://www.amazon.com/your-orders/orders?_encoding=UTF8&ref=nav_orders_first&startIndex=${i}`
      await chrome.tabs.update(options.tabId, {
        url
      });

      // A big hack: Sleep so the document has a chance to start loading.
      await new Promise(r => setTimeout(r, 1000));
      const ordersHtml = await getHtml(options.tabId)

      newOrders = this.parseOrders(ordersHtml);
      console.log(`Orders for page : ${JSON.stringify(newOrders)}`);

      if (newOrders.length) {
        orders.push(...newOrders);
      }
      i += 10;
    } while (newOrders.length && orders.length < options.maxOrders);

    return orders;
  }

  async mapTransactionsToOrders(options: { transactions: Transaction[], orders: OrderInfo[] }) {
// Here's a limitation of our strategy: For orders of multiple items, we don't know
    // which items comprised what amount of the total order. Supporting this is doable
    // but requires some work: we would have to dig into the individual orders' page,
    // and we would have to update the transaction in YNAB. So instead, we just concatenate
    // the item names into one.
    const ordersMap = new Map(options.orders.map((order) => [order.orderNumber, order.itemNames]));

    const transactions: FullTransaction[] = [];

    options.transactions.forEach((transaction) => {
      const order = ordersMap.get(transaction.orderNumber);
      if (!order) {
        console.warn(`Could not find order information for transaction with order ${transaction.orderNumber}`);
        return;
      }
      transactions.push({...transaction, itemNames: order});
    });

    return transactions
  }

  /** Get all transactions by scraping Amazon.
   *
   * For each transaction, we need the name of the order and the price. To do this, we have to get the list of all transactions on
   * https://www.amazon.com/cpe/yourpayments/transactions. This unfortunately only contains order numbers and dollar amounts, but not name.
   * We then need to go to the orders page at https://www.amazon.com/gp/css/order-history?ie=UTF8&ref=nav_orders_first
   * and page through each page of orders until we have all the ones we want. Then, we match the info from those two
   * sources up - and finally, we'll be ready to match things up with YNAB transactions.
   *
   * @param numOrders The number of orders to crawl for.
   */

  async getTransactionsTab(): Promise<chrome.tabs.Tab> {
    const tab = await getActiveTab();
    if (!tab.url) {
      throw statusAnd.error('Could not get current tab.')
    }

    if (new URL(tab.url).pathname !== '/cpe/yourpayments/transactions') {
      await chrome.tabs.create({url: "https://www.amazon.com/cpe/yourpayments/transactions", active: true})
      return getActiveTab();
    }

    return tab;
  }

  async getAmazonTransactions() {
    // First part: Amazon Transactions page, with high-level order data like number and dollar amount.
    const transactionsTab = await this.getTransactionsTab();
    const transactionsHtml = await getHtml(transactionsTab.id!);

    const transactions = this.parseTransactions(transactionsHtml);

    return {transactions, transactionsTab}
  }

  async getFullAmazonTransactions(options: { maxOrders: number }): Promise<FullTransaction[]> {
    const {transactions, transactionsTab} = await this.getAmazonTransactions();

    const orders = await this.getOrders({...options, tabId: transactionsTab.id!});
    return this.mapTransactionsToOrders({transactions, orders});
  }
}
