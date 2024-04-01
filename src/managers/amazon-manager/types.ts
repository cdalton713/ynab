/** An Amazon transaction from the transactions page. */
export interface Transaction {
  orderNumber: string;
  payee: string;
  orderDate: Date;
  priceInCents: number;
}

/** Extracted order information. */
export interface OrderInfo {
  orderNumber: string;
  itemNames: string[];
}

/** Transactions information, ready to send to YNAB. */
export interface FullTransaction {
  itemNames: string[];
  orderNumber: string;
  payee: string;
  orderDate: Date;
  priceInCents: number;
}