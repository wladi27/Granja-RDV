export type PaymentMethod = 'wallet' | 'bank_transfer' | 'mobile_payment' | 'cash' | 'cash_on_delivery';
export type DeliveryMethod = 'pickup' | 'home_delivery';
export type UserRole = 'admin' | 'customer' | 'courier';
export type AdminPermission =
  | 'dashboard.view'
  | 'orders.view'
  | 'orders.manage'
  | 'inventory.manage'
  | 'withdrawals.manage'
  | 'config.manage'
  | 'users.manage'
  | 'wallet.manage'
  | '*';
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'confirmed'
  | 'assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface CommissionLevelConfig {
  level: number;
  amountCop: number;
  enabled: boolean;
}

export interface PaymentAccountConfig {
  id: string;
  method: PaymentMethod;
  label: string;
  holderName: string;
  accountRef: string;
  details?: string;
}

export interface DeliveryFeesByMunicipality {
  Dosquebradas: number;
  Pereira: number;
  Cuba: number;
}

export interface SystemConfig {
  commissionLevels: CommissionLevelConfig[];
  gracePeriodDays: number;
  minWithdrawalCop: number;
  deliveryCommissionPercent: number;
  maxCommissionLevels: number;
  enabledPaymentMethods: PaymentMethod[];
  paymentAccounts: PaymentAccountConfig[];
  deliveryFeesByMunicipality: DeliveryFeesByMunicipality;
}

export interface Product {
  id: string;
  name: string;
  priceCop: number;
  stock: number;
}

export interface User {
  id: string;
  username: string | null;
  fullName: string;
  email: string;
  whatsappPhone: string | null;
  role: UserRole;
  permissions: AdminPermission[];
  sponsorCode?: string;
  referralCode: string;
  referredByUserId?: string;
  walletBalanceCop: number;
  membershipCutDay?: number;
  membershipActiveUntil?: string;
  purchases: string[];
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPriceCop: number;
  totalPriceCop: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalCop: number;
  deliveryFeeCop: number;
  paidFromWalletCop: number;
  pendingPaymentCop: number;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  status: OrderStatus;
  address?: string;
  phone?: string;
  courierId?: string;
  routePosition?: number;
  paymentProofDataUrl?: string;
  paymentProofStatus?: 'pending' | 'approved' | 'rejected';
  paymentProofUploadedAt?: string;
  paymentProofReviewedAt?: string;
  paymentProofReviewedByUserId?: string;
  paymentProofRejectionReason?: string;
  deliveredEvidencePhotoUrl?: string;
  deliveredSignature?: string;
  customerReceivedSignature?: string;
  customerReceivedConfirmedAt?: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface Commission {
  id: string;
  orderId: string;
  beneficiaryUserId: string;
  sourceUserId: string;
  level: number;
  amountCop: number;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amountCop: number;
  status: WithdrawalStatus;
  destination?: string;
  notes?: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  createdAt: string;
}
