export type MembershipStatus = 'active' | 'grace' | 'inactive';
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
export type DeliveryMethod = 'pickup' | 'home_delivery';
export type PaymentMethod = 'wallet' | 'bank_transfer' | 'mobile_payment' | 'cash' | 'cash_on_delivery';
export type OrderStatus = 'pending_payment' | 'paid' | 'confirmed' | 'assigned' | 'picked_up' | 'on_the_way' | 'delivered';

export interface DashboardUser {
  id: string;
  username: string | null;
  fullName: string;
  email: string;
  whatsappPhone: string | null;
  role: UserRole;
  permissions: AdminPermission[];
  referralCode: string;
  walletBalanceCop: number;
}

export interface MembershipSnapshot {
  status: MembershipStatus;
  activeUntil: string | null;
  daysRemaining: number;
}

export interface Commission {
  id: string;
  orderId: string;
  level: number;
  amountCop: number;
  createdAt: string;
}

export interface DashboardOrder {
  id: string;
  status: string;
  totalCop: number;
  deliveryMethod: string;
  createdAt: string;
}

export interface UserOrderListItem {
  id: string;
  status: OrderStatus;
  totalCop: number;
  paidFromWalletCop: number;
  pendingPaymentCop: number;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  address: string | null;
  phone: string | null;
  deliveredAt: string | null;
  courierDeliveryConfirmed: boolean;
  customerReceivedConfirmedAt: string | null;
  createdAt: string;
}

export interface UserOrdersPage {
  page: number;
  pageSize: number;
  total: number;
  orders: UserOrderListItem[];
}

export interface UserDashboard {
  user: DashboardUser;
  membership: MembershipSnapshot;
  directReferralsCount: number;
  walletBalanceCop: number;
  commissions: Commission[];
  recentOrders: DashboardOrder[];
}

export interface AdminOverview {
  users: number;
  orders: number;
  pendingDeliveries: number;
  totalSalesCop: number;
  totalCommissionsCop: number;
  totalPaidCop: number;
  totalPayableCop: number;
  totalExpensesCop: number;
  totalApprovedWithdrawalsCop: number;
  adminWalletBalanceCop: number;
  totalWalletsBalanceCop: number;
  monthlyStats: Array<{
    month: string;
    incomeCop: number;
    expensesCop: number;
    paidCop: number;
    payableCop: number;
    walletPaymentsCop: number;
  }>;
  adminWalletMovements: Array<{
    id: string;
    type: string;
    amountCop: number;
    notes: string | null;
    orderId: string | null;
    sourceUserId: string | null;
    sourceUserName: string | null;
    createdAt: string;
  }>;
}

export interface AdminOrderRow {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  deliveryFeeCop: number;
  status: OrderStatus;
  delivery_method: DeliveryMethod;
  payment_method: PaymentMethod;
  total_cop: number;
  delivery_fee_cop: number;
  pending_payment_cop: number;
  courier_id: string | null;
  courier_name: string | null;
  items_summary?: string | null;
  payment_proof_data_url?: string | null;
  payment_proof_status?: 'pending' | 'approved' | 'rejected' | null;
  payment_proof_uploaded_at?: string | null;
  payment_proof_reviewed_at?: string | null;
  payment_proof_reviewed_by_user_id?: string | null;
  payment_proof_rejection_reason?: string | null;
  created_at: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface UserWithdrawalRow {
  id: string;
  user_id: string;
  amount_cop: number;
  status: WithdrawalStatus;
  destination: string | null;
  notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface WalletSummary {
  walletBalanceCop: number;
  pendingWithdrawalsCop: number;
  minWithdrawalCop: number;
}

export interface AdminWalletPaymentResult {
  id: string;
  type: string;
  amountCop: number;
  sourceUserId: string;
  sourceUserName: string;
  notes: string | null;
  createdAt: string;
}

export interface WalletMovement {
  id: string;
  type: 'commission' | 'withdrawal' | 'order_payment';
  label: string;
  amountCop: number;
  status: string;
  date: string;
}

export interface WalletMovementsPage {
  page: number;
  pageSize: number;
  total: number;
  movements: WalletMovement[];
}

export interface AdminWithdrawalRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount_cop: number;
  status: WithdrawalStatus;
  destination: string | null;
  notes: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CourierOrderRow {
  id: string;
  user_id: string;
  customer_name: string;
  status: OrderStatus;
  delivery_method: DeliveryMethod;
  total_cop: number;
  address: string | null;
  phone: string | null;
  created_at: string;
  route_position: number | null;
  delivered_at?: string | null;
  customer_received_confirmed_at?: string | null;
}

export interface CourierOrdersPage {
  page: number;
  pageSize: number;
  total: number;
  orders: CourierOrderRow[];
}

export interface CourierDeliveredOrdersFilters {
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  customerName?: string;
  phone?: string;
  orderId?: string;
  q?: string;
}

export interface DeliveryQrPayload {
  token: string;
  deliveryCode: string;
  expiresAt: string | null;
  order: {
    id: string;
    customerName: string;
    address: string | null;
    totalCop: number;
  };
}

export interface DeliveryConfirmationPreview {
  orderId: string;
  customerName: string;
  address: string | null;
  totalCop: number;
  status: OrderStatus;
  deliveryCode: string;
  deliveredAt: string | null;
  customerReceivedConfirmedAt: string | null;
}

export interface CourierUser {
  id: string;
  full_name: string;
  email: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  priceCop: number;
  stock: number;
}

export interface InventoryProductsPage {
  page: number;
  pageSize: number;
  total: number;
  products: InventoryProduct[];
}

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

export interface AdminUserRow {
  id: string;
  username: string | null;
  fullName: string;
  email: string;
  permissions: AdminPermission[];
  createdAt: string;
}

export interface AdminCourierRow {
  id: string;
  username: string | null;
  fullName: string;
  email: string;
  whatsappPhone: string | null;
  createdAt: string;
}

export interface WithdrawalRules {
  minWithdrawalCop: number;
}

export interface ReferralLookupUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  referralCode: string;
  referredByUserId: string | null;
}

export interface ReferralNetworkLevel {
  level: number;
  count: number;
  commissionsCop: number;
}

export interface ReferralNetworkMember {
  id: string;
  fullName: string;
  email: string;
  referralCode: string;
  referredByUserId: string | null;
  level: number;
  walletBalanceCop: number;
  membershipActiveUntil: string | null;
  commissionsCop: number;
}

export interface ReferralNetwork {
  root: {
    id: string;
    fullName: string;
    email: string;
    referralCode: string;
  };
  maxDepth: number;
  summary: {
    totalMembers: number;
    directReferrals: number;
    totalCommissionsCop: number;
  };
  levels: ReferralNetworkLevel[];
  members: ReferralNetworkMember[];
}

export interface ReferralNetworkSummary {
  root: {
    id: string;
    fullName: string;
    email: string;
    referralCode: string;
  };
  maxDepth: number;
  summary: {
    totalMembers: number;
    directReferrals: number;
  };
  levels: Array<{
    level: number;
    count: number;
  }>;
}

export interface ReferralNetworkLevelMember {
  id: string;
  fullName: string;
  email: string;
  referralCode: string;
  membershipActiveUntil: string | null;
}

export interface ReferralNetworkLevelMembersPage {
  level: number;
  page: number;
  pageSize: number;
  total: number;
  members: ReferralNetworkLevelMember[];
}
