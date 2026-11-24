import { Category, Product } from '../lib/inventory';

export interface CustomerProfile {
  name: string;
  email: string;
}

export type CustomerTab = 'catalog' | 'wishlist' | 'cart' | 'orders' | 'home';
export type CatalogSort = 'featured' | 'price-low' | 'price-high' | 'name';

export interface CheckoutDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentMethod: string;
  bank: string;
  bankTransactionReference: string;
  senderName: string;
  receiptFile: File | null;
}

export const paymentBankOptions = [
  { value: 'cbe', label: 'Commercial Bank of Ethiopia (CBE)' },
  { value: 'telebirr', label: 'Telebirr' },
  { value: 'boa', label: 'Bank of Abyssinia' },
  { value: 'dashen', label: 'Dashen Bank' },
  { value: 'awash', label: 'Awash Bank' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cbebirr', label: 'CBE Birr' },
  { value: 'other', label: 'Other / manual review' },
] as const;

export interface OrderLine {
  productId: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CustomerOrder {
  id: string;
  orderNumber?: string;
  createdAt: string;
  updatedAt?: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  paymentMethod: string;
  paymentStatus?: string;
  receiptPaymentId?: string | null;
  receiptBank?: string | null;
  bankTransactionReference?: string | null;
  receiptReviewNote?: string | null;
  receiptSubmittedAt?: string | null;
  status: string;
  deliveryStatus?: string;
  deliveryNote?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  assignedAt?: string;
  acceptedAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  customerConfirmationStatus?: 'awaiting_confirmation' | 'customer_confirmed' | 'issue_reported' | null;
  customerConfirmedAt?: string | null;
  customerConfirmationUserId?: string | null;
  customerDeliveryIssue?: string;
  customerDeliveryIssueReportedAt?: string | null;
  cancellationStatus?: string;
  items: OrderLine[];
  total: number;
}

export const customerCategories: Array<Category | 'All'> = [
  'All',
  'Laptop',
  'Desktop',
  'Power Solutions',
  'Accessories',
];

export const formatCustomerPrice = (price: number) => `ETB ${price.toLocaleString()}`;

export interface CartLine {
  product: Product;
  quantity: number;
}