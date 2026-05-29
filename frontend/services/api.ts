import {
  AdminWithdrawalRow,
  AdminOrderRow,
  AdminOverview,
  AdminPermission,
  AdminCourierRow,
  AdminUserRow,
  CourierOrderRow,
  CourierOrdersPage,
  CourierDeliveredOrdersFilters,
  DeliveryConfirmationPreview,
  DeliveryQrPayload,
  DeliveryMethod,
  DashboardUser,
  InventoryProduct,
  InventoryProductsPage,
  ReferralLookupUser,
  ReferralNetwork,
  ReferralNetworkLevelMembersPage,
  ReferralNetworkSummary,
  PaymentMethod,
  SystemConfig,
  UserWithdrawalRow,
  WalletMovementsPage,
  AdminWalletPaymentResult,
  PaymentAccountConfig,
  DeliveryFeesByMunicipality,
  WalletSummary,
  WithdrawalRules,
  UserDashboard,
  UserOrdersPage,
} from '@/types/domain';
import { getAccessToken } from '@/services/session';
import { clearAuthSession, getAuthSession, setAuthSession } from '@/services/auth-session';
import { normalizeError, parseBackendErrorMessage, toFriendlyErrorMessage } from '@/services/error-utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api';
let activeRefreshPromise: Promise<string | null> | null = null;

function extractAuthorizationHeader(headers?: HeadersInit): string | null {
  if (!headers) {
    return null;
  }

  return new Headers(headers).get('Authorization');
}

async function refreshAccessToken(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const session = getAuthSession();
    if (!session?.refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { tokens?: { accessToken?: string; refreshToken?: string } };
      const nextAccessToken = payload.tokens?.accessToken;
      if (!nextAccessToken) {
        return null;
      }

      setAuthSession({
        ...session,
        accessToken: nextAccessToken,
        refreshToken: payload.tokens?.refreshToken ?? session.refreshToken,
      });

      return nextAccessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
}

function shouldForceLogin(status: number, message: string): boolean {
  if (status === 401) {
    return true;
  }

  return /unauthorized|missing bearer|token expired|jwt expired|invalid token/i.test(message);
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }

  clearAuthSession();

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = encodeURIComponent(currentPath || '/');

  if (window.location.pathname !== '/login') {
    window.location.replace(`/login?next=${next}`);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    if (shouldForceLogin(response.status, text)) {
      redirectToLogin();
    }
    const parsed = parseBackendErrorMessage(text);
    throw new Error(toFriendlyErrorMessage(parsed, 'No fue posible completar la solicitud.'));
  }
  return (await response.json()) as T;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init);
    if (response.status !== 401 || input.endsWith('/auth/refresh')) {
      return response;
    }

    const authHeader = extractAuthorizationHeader(init?.headers);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response;
    }

    const nextAccessToken = await refreshAccessToken();
    if (!nextAccessToken) {
      return response;
    }

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set('Authorization', `Bearer ${nextAccessToken}`);

    return await fetch(input, {
      ...init,
      headers: retryHeaders,
    });
  } catch (error) {
    throw new Error(normalizeError(error, 'No se pudo conectar con el servidor.'));
  }
}

export async function getUserDashboard(userId: string): Promise<UserDashboard> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/dashboard`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<UserDashboard>(response);
}

export async function getUserOrdersPage(userId: string, page = 1, pageSize = 20): Promise<UserOrdersPage> {
  const token = getAccessToken();
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/orders?${query.toString()}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<UserOrdersPage>(response);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/admin/overview`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<AdminOverview>(response);
}

export async function getAdminOrders(limit = 30): Promise<AdminOrderRow[]> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/admin/list?limit=${limit}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<AdminOrderRow[]>(response);
}

export async function getAdminWithdrawals(
  status?: 'pending' | 'approved' | 'rejected',
  limit = 80,
): Promise<AdminWithdrawalRow[]> {
  const token = getAccessToken();
  const query = new URLSearchParams({ limit: String(limit) });
  if (status) {
    query.set('status', status);
  }

  const response = await apiFetch(`${API_BASE_URL}/withdrawals/admin/list?${query.toString()}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<AdminWithdrawalRow[]>(response);
}

export async function reviewWithdrawal(
  withdrawalId: string,
  decision: 'approved' | 'rejected',
  notes?: string,
) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/withdrawals/${withdrawalId}/review`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify({ decision, notes }),
  });

  return handleResponse(response);
}

export async function getMyWithdrawals(limit = 30): Promise<UserWithdrawalRow[]> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/withdrawals/me?limit=${limit}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<UserWithdrawalRow[]>(response);
}

export async function createWithdrawalRequest(input: { amountCop: number; destination?: string; notes?: string }) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/withdrawals`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse<UserWithdrawalRow>(response);
}

export async function getCourierOrders(page = 1, pageSize = 10): Promise<CourierOrdersPage> {
  const token = getAccessToken();
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await apiFetch(`${API_BASE_URL}/orders/courier/my?${query.toString()}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<CourierOrdersPage>(response);
}

export async function getCourierRoute(): Promise<CourierOrderRow[]> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/courier/route`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<CourierOrderRow[]>(response);
}

export async function getCourierDeliveredOrders(filters: CourierDeliveredOrdersFilters = {}): Promise<CourierOrdersPage> {
  const token = getAccessToken();
  const query = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 10),
  });

  if (filters.fromDate?.trim()) {
    query.set('fromDate', filters.fromDate.trim());
  }
  if (filters.toDate?.trim()) {
    query.set('toDate', filters.toDate.trim());
  }
  if (filters.customerName?.trim()) {
    query.set('customerName', filters.customerName.trim());
  }
  if (filters.phone?.trim()) {
    query.set('phone', filters.phone.trim());
  }
  if (filters.orderId?.trim()) {
    query.set('orderId', filters.orderId.trim());
  }
  if (filters.q?.trim()) {
    query.set('q', filters.q.trim());
  }

  const response = await apiFetch(`${API_BASE_URL}/orders/courier/delivered?${query.toString()}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<CourierOrdersPage>(response);
}

export async function addOrderToCourierRoute(orderId: string): Promise<CourierOrderRow> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/courier-route`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<CourierOrderRow>(response);
}

export async function reorderCourierRoute(orderIds: string[]): Promise<CourierOrderRow[]> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/courier/route`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify({ orderIds }),
  });

  return handleResponse<CourierOrderRow[]>(response);
}

export async function getCouriers(): Promise<Array<{ id: string; full_name: string; email: string }>> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/admin/couriers`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<Array<{ id: string; full_name: string; email: string }>>(response);
}

export async function confirmOrderPayment(orderId: string) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/confirm-payment`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse(response);
}

export async function rejectOrderPayment(orderId: string, reason?: string) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/reject-payment`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify({ reason }),
  });

  return handleResponse(response);
}

export async function confirmOrder(orderId: string) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/confirm`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse(response);
}

export async function confirmCustomerOrderReceipt(orderId: string) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/customer-receipt`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse(response);
}

export async function getDeliveryQr(orderId: string): Promise<DeliveryQrPayload> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/delivery-qr`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<DeliveryQrPayload>(response);
}

export async function getDeliveryConfirmationPreview(token: string): Promise<DeliveryConfirmationPreview> {
  const accessToken = getAccessToken();
  const query = new URLSearchParams({ token });
  const response = await apiFetch(`${API_BASE_URL}/public/orders/delivery-confirmation?${query.toString()}`, {
    cache: 'no-store',
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  return handleResponse<DeliveryConfirmationPreview>(response);
}

export async function confirmDeliveryByToken(token: string) {
  const accessToken = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/public/orders/delivery-confirmation`, {
    method: 'POST',
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    body: JSON.stringify({ token }),
  });

  return handleResponse(response);
}

export async function assignCourier(orderId: string, courierId: string) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/assign-courier`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify({ courierId }),
  });

  return handleResponse(response);
}

export async function updateCourierOrderStatus(
  orderId: string,
  status: 'picked_up' | 'on_the_way',
) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/courier-status`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify({
      status,
    }),
  });

  return handleResponse(response);
}

export async function getInventoryProducts(): Promise<InventoryProduct[]> {
  const response = await apiFetch(`${API_BASE_URL}/catalog/products`, {
    cache: 'no-store',
  });

  return handleResponse<InventoryProduct[]>(response);
}

export async function getInventoryProductsPage(page = 1, pageSize = 24, search = ''): Promise<InventoryProductsPage> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search.trim()) {
    query.set('search', search.trim());
  }

  const response = await apiFetch(`${API_BASE_URL}/catalog/products/page?${query.toString()}`, {
    cache: 'no-store',
  });

  return handleResponse<InventoryProductsPage>(response);
}

export async function createOrder(input: {
  userId?: string;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryFeeCop?: number;
  address?: string;
  phone?: string;
  useWallet: boolean;
  paymentProofDataUrl?: string;
  items: Array<{ productId: string; quantity: number }>;
}) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse(response);
}

export async function createInventoryProduct(input: {
  id?: string;
  name: string;
  priceCop: number;
  stock: number;
}) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/catalog/products`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse(response);
}

export async function updateInventoryProduct(
  productId: string,
  patch: { name?: string; priceCop?: number; stock?: number },
) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(patch),
  });

  return handleResponse(response);
}

export async function adjustInventoryStock(productId: string, delta: number) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/catalog/products/${productId}/stock`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify({ delta }),
  });

  return handleResponse(response);
}

export async function deleteInventoryProduct(productId: string) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/catalog/products/${productId}`, {
    method: 'DELETE',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse(response);
}

export async function getSystemConfig(): Promise<SystemConfig> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<SystemConfig>(response);
}

export async function updateSystemConfig(patch: Partial<SystemConfig>) {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(patch),
  });

  return handleResponse<SystemConfig>(response);
}

export async function getPaymentSettings(): Promise<{ enabledPaymentMethods: PaymentMethod[]; paymentAccounts: PaymentAccountConfig[]; deliveryFeesByMunicipality: DeliveryFeesByMunicipality }> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/payment-settings`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<{ enabledPaymentMethods: PaymentMethod[]; paymentAccounts: PaymentAccountConfig[]; deliveryFeesByMunicipality: DeliveryFeesByMunicipality }>(response);
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/admin-users`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<AdminUserRow[]>(response);
}

export async function createAdminUser(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  permissions: AdminPermission[];
}): Promise<AdminUserRow> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/admin-users`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse<AdminUserRow>(response);
}

export async function updateAdminUser(
  adminUserId: string,
  input: {
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    permissions?: AdminPermission[];
  },
): Promise<AdminUserRow> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/admin-users/${adminUserId}`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse<AdminUserRow>(response);
}

export async function getCourierUsers(): Promise<AdminCourierRow[]> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/courier-users`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<AdminCourierRow[]>(response);
}

export async function createCourierUser(input: {
  fullName: string;
  username: string;
  email: string;
  whatsappPhone?: string;
  password: string;
}): Promise<AdminCourierRow> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/courier-users`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse<AdminCourierRow>(response);
}

export async function updateCourierUser(
  courierUserId: string,
  input: {
    fullName?: string;
    username?: string;
    email?: string;
    whatsappPhone?: string;
    password?: string;
  },
): Promise<AdminCourierRow> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/courier-users/${courierUserId}`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse<AdminCourierRow>(response);
}

export async function getWithdrawalRules(): Promise<WithdrawalRules> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/config/withdrawal-rules`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<WithdrawalRules>(response);
}

export async function getUserByReferralCode(referralCode: string): Promise<ReferralLookupUser> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/users/referral/${encodeURIComponent(referralCode)}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<ReferralLookupUser>(response);
}

export async function getReferralNetwork(userId: string): Promise<ReferralNetwork> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/network`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<ReferralNetwork>(response);
}

export async function getReferralNetworkSummary(userId: string, maxDepth = 7): Promise<ReferralNetworkSummary> {
  const token = getAccessToken();
  const query = new URLSearchParams({ maxDepth: String(maxDepth) });
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/network/summary?${query.toString()}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<ReferralNetworkSummary>(response);
}

export async function getReferralNetworkLevelMembers(
  userId: string,
  level: number,
  page = 1,
  pageSize = 25,
  maxDepth = 7,
): Promise<ReferralNetworkLevelMembersPage> {
  const token = getAccessToken();
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    maxDepth: String(maxDepth),
  });
  const response = await apiFetch(
    `${API_BASE_URL}/users/${userId}/network/levels/${level}/members?${query.toString()}`,
    {
      cache: 'no-store',
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    },
  );

  return handleResponse<ReferralNetworkLevelMembersPage>(response);
}

export async function getUserWalletSummary(userId: string): Promise<WalletSummary> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/wallet/summary`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<WalletSummary>(response);
}

export async function payAdminFromWallet(userId: string, input: { amountCop: number; notes?: string }): Promise<AdminWalletPaymentResult> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/wallet/pay-admin`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(input),
  });

  return handleResponse<AdminWalletPaymentResult>(response);
}

export async function getUserWalletMovements(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<WalletMovementsPage> {
  const token = getAccessToken();
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/wallet/movements?${query.toString()}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  return handleResponse<WalletMovementsPage>(response);
}

export async function updateUserProfile(
  userId: string,
  patch: {
    username?: string;
    fullName?: string;
    email?: string;
    whatsappPhone?: string;
    currentPassword?: string;
    newPassword?: string;
  },
): Promise<DashboardUser> {
  const token = getAccessToken();
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}/profile`, {
    method: 'PATCH',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(patch),
  });

  return handleResponse<DashboardUser>(response);
}

