export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string | null;
  quantity: number;
  reorderLevel: number;
  cost: number;
  price: number;
  location: string | null;
  unit: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryHistoryEntry = {
  id: string;
  itemId: string;
  action: 'ADD' | 'REMOVE' | 'CREATE' | 'UPDATE';
  quantity: number;
  notes: string | null;
  userId: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  createdAt: string;
};

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED';

export type PaymentMethod = 'CREDIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHECK';

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address?: {
    id: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
};

export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  transactionId: string | null;
  date: string | null;
};

export type OrderStatusHistory = {
  id: string;
  orderId: string;
  status: OrderStatus;
  notes: string | null;
  userId: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  createdAt: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  items: OrderItem[];
  payment: Payment;
  statusHistory?: OrderStatusHistory[];
};

export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  metadata: any;
  createdAt: string;
};

export type User = {
  id: string;
  name: string | null;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'VIEWER';
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
};