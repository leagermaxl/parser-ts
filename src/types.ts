export interface OrderStatus {
  value: number;
  text: string;
}

export interface Product {
  name: string;
  article: string | null;
  image: string | null;
  price: number;
  quantity: number;
  totalPrice: number;
}

export interface Coupon {
  discountPercent: string | null;
  code: string;
}

export interface Order {
  orderId: number;
  orderNum: number;
  orderStatus: OrderStatus;
  orderDate: string | null;
  totalAmount: number | '';
  amountWithCoupon: number | '';
  amountPayment: number;
  products: Product[];
  coupon: Coupon | null;
}

export type OrdersWithTotal = Order[] & { amountEntire?: number };

export interface OrderIdRef {
  orderId: number;
  orderNum: number;
}

/** Order ref as scraped straight from the order-list HTML page: fields stay strings. */
export interface ScrapedOrderRef {
  orderId: string;
  orderNum: string;
}

export interface OrdersConfig {
  lastOrderId: number;
  ordersInProgress: OrderIdRef[];
}

export type BackupReason = 'manual' | 'auto-run' | 'auto-restore';

export interface BackupMeta {
  filePath: string;
  reason: BackupReason;
  timestamp: Date;
  lastOrderId: number;
  ordersInProgressCount: number;
}

export interface OrderTableRow {
  tableIndex: number;
  data: Record<string, string>;
  OrderNumber: string;
  orderStatus: OrderStatus;
  products: Product[];
}
