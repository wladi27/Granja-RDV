'use client';

import { useEffect, useState } from 'react';
import {
  adjustInventoryStock,
  assignCourier,
  createAdminUser,
  confirmOrder,
  confirmOrderPayment,
  rejectOrderPayment,
  createInventoryProduct,
  deleteInventoryProduct,
  getAdminOrders,
  getAdminUsers,
  getAdminOverview,
  getAdminWithdrawals,
  getCouriers,
  getInventoryProducts,
  getReferralNetwork,
  reviewWithdrawal,
  getSystemConfig,
  getUserByReferralCode,
  updateSystemConfig,
  updateInventoryProduct,
  updateAdminUser,
} from '@/services/api';
import {
  AdminOrderRow,
  AdminPermission,
  AdminOverview,
  AdminWithdrawalRow,
  CommissionLevelConfig,
  CourierUser,
  InventoryProduct,
  PaymentMethod,
  ReferralNetwork,
  SystemConfig,
  AdminUserRow,
} from '@/types/domain';

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string; description: string }> = [
  {
    value: 'wallet',
    label: 'Wallet',
    description: 'Permite pagar con saldo interno del usuario.',
  },
  {
    value: 'bank_transfer',
    label: 'Transferencia bancaria',
    description: 'Requiere comprobante para validacion administrativa.',
  },
  {
    value: 'mobile_payment',
    label: 'Pago movil',
    description: 'Requiere comprobante para validacion administrativa.',
  },
  {
    value: 'cash',
    label: 'Efectivo',
    description: 'Pago en efectivo con validacion directa administrativa.',
  },
];

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-');
  const numericYear = Number(year);
  const numericMonth = Number(month);
  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    return value;
  }

  const date = new Date(Date.UTC(numericYear, numericMonth - 1, 1));
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(date);
}

function formatAdminWalletMovementType(type: string): string {
  switch (type) {
    case 'order_wallet_payment':
      return 'Pago de pedido desde wallet';
    case 'manual_wallet_payment':
      return 'Pago directo al admin';
    default:
      return type.replaceAll('_', ' ');
  }
}

function formatOrderStatusLabel(status: AdminOrderRow['status']): string {
  const labels: Record<AdminOrderRow['status'], string> = {
    pending_payment: 'Pendiente de pago',
    paid: 'Pagado',
    confirmed: 'Confirmado',
    assigned: 'Asignado',
    picked_up: 'Recogido',
    on_the_way: 'En camino',
    delivered: 'Entregado',
  };

  return labels[status] ?? status.replaceAll('_', ' ');
}

function getOrderStatusTone(status: AdminOrderRow['status']): string {
  switch (status) {
    case 'pending_payment':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'paid':
    case 'confirmed':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'assigned':
    case 'picked_up':
    case 'on_the_way':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'delivered':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-[var(--line)] bg-white text-[var(--muted)]';
  }
}

function formatDeliveryMethodLabel(deliveryMethod: AdminOrderRow['delivery_method']): string {
  return deliveryMethod === 'home_delivery' ? 'Domicilio' : 'Recogida';
}

function formatPaymentMethodLabel(paymentMethod: PaymentMethod): string {
  switch (paymentMethod) {
    case 'wallet':
      return 'Wallet';
    case 'bank_transfer':
      return 'Transferencia';
    case 'mobile_payment':
      return 'Pago movil';
    case 'cash':
    case 'cash_on_delivery':
      return 'Efectivo';
    default:
      return paymentMethod.replaceAll('_', ' ');
  }
}

function formatPaymentProofStatusLabel(status: AdminOrderRow['payment_proof_status']): string {
  switch (status) {
    case 'approved':
      return 'Comprobante aprobado';
    case 'rejected':
      return 'Comprobante rechazado';
    case 'pending':
      return 'Comprobante pendiente';
    default:
      return 'Sin comprobante';
  }
}

function getPaymentProofTone(status: AdminOrderRow['payment_proof_status']): string {
  switch (status) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    default:
      return 'border-[var(--line)] bg-[var(--surface-50)] text-[var(--muted)]';
  }
}

function normalizePaymentMethod(method: PaymentMethod): PaymentMethod {
  return method === 'cash_on_delivery' ? 'cash' : method;
}

function requiresPaymentProof(method: PaymentMethod): boolean {
  const normalizedMethod = normalizePaymentMethod(method);
  return normalizedMethod === 'bank_transfer' || normalizedMethod === 'mobile_payment';
}

function isHomeDeliveryCashOrder(order: AdminOrderRow): boolean {
  return order.delivery_method === 'home_delivery' && normalizePaymentMethod(order.payment_method) === 'cash';
}

function getAdminOrderNextAction(order: AdminOrderRow): { title: string; detail: string } {
  switch (order.status) {
    case 'pending_payment':
      if (isHomeDeliveryCashOrder(order)) {
        return {
          title: 'Asignar repartidor',
          detail: 'Primero asigna la ruta. El pago en efectivo se valida cuando el repartidor entrega el dinero.',
        };
      }
      return {
        title: 'Validar pago',
        detail: 'Confirma el pago para habilitar la revisión operativa del pedido.',
      };
    case 'paid':
      return {
        title: 'Confirmar pedido',
        detail: 'Valida la orden para enviarla a preparación o asignación logística.',
      };
    case 'confirmed':
      return order.delivery_method === 'home_delivery'
        ? {
            title: 'Asignar repartidor',
            detail: 'Selecciona el repartidor responsable antes de sacar la orden a ruta.',
          }
        : {
            title: 'Pedido listo',
            detail: 'La orden ya está confirmada y queda disponible para recogida en tienda.',
          };
    case 'assigned':
      if (isHomeDeliveryCashOrder(order) && order.pending_payment_cop > 0) {
        return {
          title: 'Recaudo pendiente',
          detail: 'El repartidor ya va en ruta. Cuando entregue el efectivo, marca el pedido como pagado.',
        };
      }
      return {
        title: 'Esperando recogida',
        detail: 'El pedido ya fue asignado. El siguiente paso lo ejecuta el repartidor.',
      };
    case 'picked_up':
      return {
        title: 'Pedido recogido',
        detail: 'El repartidor retiró el pedido y debe marcarlo en camino.',
      };
    case 'on_the_way':
      return {
        title: 'Entrega en curso',
        detail: 'El repartidor debe mostrar el QR al cliente para confirmar la recepción.',
      };
    case 'delivered':
      return {
        title: 'Entrega cerrada',
        detail: 'La entrega quedó finalizada.',
      };
    default:
      return {
        title: 'Revisar pedido',
        detail: 'Verifica el estado actual del pedido.',
      };
  }
}

function formatWithdrawalStatusLabel(status: 'pending' | 'approved' | 'rejected'): string {
  const labels: Record<'pending' | 'approved' | 'rejected', string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };

  return labels[status] ?? status;
}

function formatAdminPermissionLabel(permission: AdminPermission): string {
  const labels: Record<AdminPermission, string> = {
    '*': 'Todos los permisos',
    'dashboard.view': 'Ver dashboard',
    'orders.view': 'Ver órdenes',
    'orders.manage': 'Gestionar órdenes',
    'inventory.manage': 'Gestionar inventario',
    'withdrawals.manage': 'Gestionar retiros',
    'config.manage': 'Gestionar configuración',
    'users.manage': 'Gestionar usuarios',
    'wallet.manage': 'Gestionar wallet',
  };

  return labels[permission] ?? permission;
}

const ADMIN_PERMISSION_OPTIONS: AdminPermission[] = [
  '*',
  'dashboard.view',
  'orders.view',
  'orders.manage',
  'inventory.manage',
  'withdrawals.manage',
  'config.manage',
  'users.manage',
  'wallet.manage',
];

function getWithdrawalStatusTone(status: 'pending' | 'approved' | 'rejected'): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-700';
    case 'approved':
      return 'bg-emerald-50 text-emerald-700';
    case 'rejected':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-white text-[var(--ink)]';
  }
}

function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconEdit({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5 12.5-12.5Z" />
    </svg>
  );
}

function IconTrash({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

interface AdminDashboardProps {
  section?: 'home' | 'orders' | 'inventory' | 'withdrawals' | 'config';
}

export function AdminDashboard({ section = 'home' }: AdminDashboardProps) {
  const HOME_MONTHS_PAGE_SIZE = 3;
  const HOME_WALLET_PAGE_SIZE = 5;
  const ORDERS_PAGE_SIZE = 8;
  const INVENTORY_PAGE_SIZE = 8;
  const WITHDRAWALS_PAGE_SIZE = 8;
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRow[]>([]);
  const [couriers, setCouriers] = useState<CourierUser[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [configCommissionLevels, setConfigCommissionLevels] = useState<CommissionLevelConfig[]>([]);
  const [gracePeriodDays, setGracePeriodDays] = useState('3');
  const [minWithdrawalCop, setMinWithdrawalCop] = useState('50000');
  const [deliveryCommissionPercent, setDeliveryCommissionPercent] = useState('0');
  const [maxCommissionLevels, setMaxCommissionLevels] = useState('10');
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>(['wallet', 'bank_transfer', 'mobile_payment', 'cash']);
  const [adminUserEditingId, setAdminUserEditingId] = useState<string | null>(null);
  const [adminUserFormFullName, setAdminUserFormFullName] = useState('');
  const [adminUserFormUsername, setAdminUserFormUsername] = useState('');
  const [adminUserFormEmail, setAdminUserFormEmail] = useState('');
  const [adminUserFormPassword, setAdminUserFormPassword] = useState('');
  const [adminUserFormPermissions, setAdminUserFormPermissions] = useState<AdminPermission[]>(['dashboard.view']);
  const [networkCode, setNetworkCode] = useState('');
  const [networkData, setNetworkData] = useState<ReferralNetwork | null>(null);
  const [courierByOrder, setCourierByOrder] = useState<Record<string, string>>({});
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<'all' | AdminOrderRow['status']>('all');
  const [homeMonthsPage, setHomeMonthsPage] = useState(1);
  const [homeWalletPage, setHomeWalletPage] = useState(1);
  const [inventoryModalMode, setInventoryModalMode] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [inventorySelectedProduct, setInventorySelectedProduct] = useState<InventoryProduct | null>(null);
  const [inventoryFormName, setInventoryFormName] = useState('');
  const [inventoryFormPrice, setInventoryFormPrice] = useState('0');
  const [inventoryFormStock, setInventoryFormStock] = useState('0');
  const [inventoryFormStockDelta, setInventoryFormStockDelta] = useState('0');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryActionLoading, setInventoryActionLoading] = useState(false);
  const [withdrawalsStatusFilter, setWithdrawalsStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [withdrawalsSearch, setWithdrawalsSearch] = useState('');
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [proofPreviewModal, setProofPreviewModal] = useState<{ orderId: string; imageUrl: string } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function applySystemConfig(configData: SystemConfig) {
    setSystemConfig(configData);
    setConfigCommissionLevels(configData.commissionLevels);
    setGracePeriodDays(String(configData.gracePeriodDays));
    setMinWithdrawalCop(String(configData.minWithdrawalCop));
    setDeliveryCommissionPercent(String(configData.deliveryCommissionPercent));
    setMaxCommissionLevels(String(configData.maxCommissionLevels));
    setEnabledPaymentMethods(configData.enabledPaymentMethods);
  }

  function handleTogglePaymentMethod(method: PaymentMethod) {
    setEnabledPaymentMethods((current) => {
      if (current.includes(method)) {
        return current.filter((item) => item !== method);
      }

      return [...current, method];
    });
  }

  function resetAdminUserForm() {
    setAdminUserEditingId(null);
    setAdminUserFormFullName('');
    setAdminUserFormUsername('');
    setAdminUserFormEmail('');
    setAdminUserFormPassword('');
    setAdminUserFormPermissions(['dashboard.view']);
  }

  function openCreateAdminUserForm() {
    resetAdminUserForm();
  }

  function openEditAdminUserForm(adminUser: AdminUserRow) {
    setAdminUserEditingId(adminUser.id);
    setAdminUserFormFullName(adminUser.fullName);
    setAdminUserFormUsername(adminUser.username ?? '');
    setAdminUserFormEmail(adminUser.email);
    setAdminUserFormPassword('');
    setAdminUserFormPermissions(adminUser.permissions.length > 0 ? adminUser.permissions : ['dashboard.view']);
  }

  async function loadData() {
    const tasks: Promise<unknown>[] = [];

    if (section === 'home') {
      tasks.push(getAdminOverview().then((overviewData) => {
        setOverview(overviewData);
      }));
    }

    if (section === 'orders') {
      tasks.push(
        Promise.all([getAdminOrders(30), getCouriers()]).then(([ordersData, couriersData]) => {
          setOrders(ordersData);
          setCouriers(couriersData);
          setCourierByOrder((current) => {
            const next = { ...current };
            for (const order of ordersData) {
              if (!next[order.id]) {
                next[order.id] = order.courier_id ?? couriersData[0]?.id ?? '';
              }
            }
            return next;
          });
        }),
      );
    }

    if (section === 'inventory') {
      tasks.push(getInventoryProducts().then((productsData) => setProducts(productsData)));
    }

    if (section === 'withdrawals') {
      tasks.push(getAdminWithdrawals(undefined, 80).then((withdrawalsData) => setWithdrawals(withdrawalsData)));
    }

    if (section === 'config') {
      tasks.push(
        Promise.all([getSystemConfig(), getAdminUsers()]).then(([configData, adminUsersData]) => {
          applySystemConfig(configData);
          setAdminUsers(adminUsersData);
        }),
      );
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  useEffect(() => {
    let mounted = true;

    loadData()
      .then(() => {
        if (!mounted) {
          return;
        }
        setLoading(false);
      })
      .catch((fetchError: Error) => {
        if (!mounted) {
          return;
        }
        setError(fetchError.message);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleConfirmPayment(orderId: string) {
    setActionMessage(null);
    try {
      await confirmOrderPayment(orderId);
      await loadData();
      setActionMessage('Pago confirmado');
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo confirmar pago');
    }
  }

  async function handleRejectPayment(orderId: string) {
    const reason = typeof window !== 'undefined' ? window.prompt('Motivo del rechazo (opcional):') : null;
    setActionMessage(null);
    try {
      await rejectOrderPayment(orderId, reason ?? undefined);
      await loadData();
      setActionMessage('Pago rechazado y marcado para correccion');
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo rechazar el pago');
    }
  }

  async function handleConfirmOrder(orderId: string) {
    setActionMessage(null);
    try {
      await confirmOrder(orderId);
      await loadData();
      setActionMessage('Orden confirmada');
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo confirmar orden');
    }
  }

  async function handleAssignCourier(orderId: string) {
    const courierId = courierByOrder[orderId];
    if (!courierId) {
      setActionMessage('Selecciona un repartidor antes de asignar');
      return;
    }

    setActionMessage(null);
    try {
      await assignCourier(orderId, courierId);
      await loadData();
      setActionMessage('Repartidor asignado');
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo asignar repartidor');
    }
  }

  function closeInventoryModal() {
    setInventoryModalMode(null);
    setInventorySelectedProduct(null);
    setInventoryFormName('');
    setInventoryFormPrice('0');
    setInventoryFormStock('0');
    setInventoryFormStockDelta('0');
  }

  function openProofPreviewModal(orderId: string, imageUrl: string) {
    setProofPreviewModal({ orderId, imageUrl });
  }

  function closeProofPreviewModal() {
    setProofPreviewModal(null);
  }

  function openCreateProductModal() {
    setInventorySelectedProduct(null);
    setInventoryFormName('');
    setInventoryFormPrice('0');
    setInventoryFormStock('0');
    setInventoryFormStockDelta('0');
    setInventoryModalMode('create');
  }

  function openEditProductModal(product: InventoryProduct) {
    setInventorySelectedProduct(product);
    setInventoryFormName(product.name);
    setInventoryFormPrice(String(product.priceCop));
    setInventoryFormStock(String(product.stock));
    setInventoryFormStockDelta('0');
    setInventoryModalMode('edit');
  }

  function openDeleteProductModal(product: InventoryProduct) {
    setInventorySelectedProduct(product);
    setInventoryModalMode('delete');
  }

  async function handleSubmitInventoryModal() {
    const normalizedName = inventoryFormName.trim();
    const priceCop = Number(inventoryFormPrice);
    const stock = Number(inventoryFormStock);
    const stockDelta = Number(inventoryFormStockDelta);

    if (!normalizedName) {
      setActionMessage('El nombre del producto es obligatorio');
      return;
    }

    if (!Number.isFinite(priceCop) || priceCop < 0) {
      setActionMessage('El precio debe ser mayor o igual a 0');
      return;
    }

    if (inventoryModalMode === 'create' && (!Number.isFinite(stock) || stock < 0)) {
      setActionMessage('El stock inicial debe ser mayor o igual a 0');
      return;
    }

    if (inventoryModalMode === 'edit' && (!Number.isFinite(stockDelta) || !Number.isInteger(stockDelta))) {
      setActionMessage('El ajuste de stock debe ser un número entero');
      return;
    }

    setActionMessage(null);
    setInventoryActionLoading(true);
    try {
      if (inventoryModalMode === 'create') {
        await createInventoryProduct({
          name: normalizedName,
          priceCop,
          stock,
        });
        setActionMessage('Producto creado');
      }

      if (inventoryModalMode === 'edit' && inventorySelectedProduct) {
        await updateInventoryProduct(inventorySelectedProduct.id, {
          name: normalizedName,
          priceCop,
        });
        if (stockDelta !== 0) {
          await adjustInventoryStock(inventorySelectedProduct.id, stockDelta);
        }
        setActionMessage('Producto actualizado');
      }

      await loadData();
      closeInventoryModal();
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo guardar el producto');
    } finally {
      setInventoryActionLoading(false);
    }
  }

  async function handleConfirmDeleteProduct() {
    if (!inventorySelectedProduct) {
      return;
    }

    setActionMessage(null);
    setInventoryActionLoading(true);
    setActionMessage(null);
    try {
      await deleteInventoryProduct(inventorySelectedProduct.id);
      await loadData();
      closeInventoryModal();
      setActionMessage('Producto eliminado');
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo eliminar producto');
    } finally {
      setInventoryActionLoading(false);
    }
  }

  async function handleSaveConfig() {
    const grace = Number(gracePeriodDays);
    const minWithdrawal = Number(minWithdrawalCop);
    const deliveryCommission = Number(deliveryCommissionPercent);
    const maxLevels = Number(maxCommissionLevels);

    if (!Number.isFinite(grace) || grace < 0 || grace > 30) {
      setActionMessage('Los dias de gracia deben estar entre 0 y 30');
      return;
    }

    if (!Number.isFinite(minWithdrawal) || minWithdrawal < 0) {
      setActionMessage('El retiro minimo debe ser mayor o igual a 0');
      return;
    }

    if (!Number.isFinite(deliveryCommission) || deliveryCommission < 0 || deliveryCommission > 100) {
      setActionMessage('La comision de delivery debe estar entre 0% y 100%');
      return;
    }

    if (!Number.isFinite(maxLevels) || maxLevels < 1 || maxLevels > 20) {
      setActionMessage('El maximo de generaciones debe estar entre 1 y 20');
      return;
    }

    if (configCommissionLevels.length === 0) {
      setActionMessage('Debes configurar al menos una generacion de comision');
      return;
    }

    const normalizedLevels = configCommissionLevels
      .map((level) => ({
        level: Number(level.level),
        amountCop: Number(level.amountCop),
        enabled: Boolean(level.enabled),
      }))
      .sort((a, b) => a.level - b.level);

    if (normalizedLevels.some((level) => !Number.isFinite(level.level) || level.level < 1)) {
      setActionMessage('Cada generacion debe tener un numero mayor o igual a 1');
      return;
    }

    if (normalizedLevels.some((level) => !Number.isFinite(level.amountCop) || level.amountCop < 0)) {
      setActionMessage('Cada bono por generacion debe ser mayor o igual a 0');
      return;
    }

    const uniqueLevels = new Set(normalizedLevels.map((level) => level.level));
    if (uniqueLevels.size !== normalizedLevels.length) {
      setActionMessage('No se permiten generaciones duplicadas en comisiones');
      return;
    }

    if (normalizedLevels.length > maxLevels) {
      setActionMessage('El numero de generaciones configuradas no puede superar el maximo');
      return;
    }

    if (enabledPaymentMethods.length === 0) {
      setActionMessage('Debes habilitar al menos un metodo de pago');
      return;
    }

    setActionMessage(null);
    try {
      const updated = await updateSystemConfig({
        gracePeriodDays: grace,
        minWithdrawalCop: minWithdrawal,
        deliveryCommissionPercent: deliveryCommission,
        maxCommissionLevels: maxLevels,
        commissionLevels: normalizedLevels,
        enabledPaymentMethods,
      });

      applySystemConfig(updated);
      setActionMessage('Configuracion MLM actualizada');
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo actualizar configuracion');
    }
  }

  function handleResetConfigForm() {
    if (!systemConfig) {
      return;
    }

    applySystemConfig(systemConfig);
    setActionMessage('Formulario restaurado con la configuracion guardada');
  }

  async function handleReviewWithdrawal(withdrawalId: string, decision: 'approved' | 'rejected') {
    setActionMessage(null);
    try {
      await reviewWithdrawal(withdrawalId, decision);
      await loadData();
      setActionMessage(decision === 'approved' ? 'Retiro aprobado' : 'Retiro rechazado');
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo actualizar el retiro');
    }
  }

  function handleToggleAdminPermission(permission: AdminPermission) {
    setAdminUserFormPermissions((current) => {
      if (permission === '*') {
        return ['*'];
      }

      const filtered = current.filter((item) => item !== '*');
      if (filtered.includes(permission)) {
        return filtered.filter((item) => item !== permission);
      }

      return [...filtered, permission];
    });
  }

  async function handleSubmitAdminUser() {
    const fullName = adminUserFormFullName.trim();
    const username = adminUserFormUsername.trim();
    const email = adminUserFormEmail.trim();
    const password = adminUserFormPassword.trim();

    if (!fullName || !username || !email) {
      setActionMessage('Completa nombre, usuario y correo para el admin');
      return;
    }

    if (adminUserFormPermissions.length === 0) {
      setActionMessage('Selecciona al menos un permiso para el admin');
      return;
    }

    if (!adminUserEditingId && password.length < 8) {
      setActionMessage('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (adminUserEditingId && password && password.length < 8) {
      setActionMessage('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    setActionMessage(null);
    try {
      if (adminUserEditingId) {
        await updateAdminUser(adminUserEditingId, {
          fullName,
          username,
          email,
          password: password || undefined,
          permissions: adminUserFormPermissions,
        });
        setActionMessage('Admin actualizado');
      } else {
        await createAdminUser({
          fullName,
          username,
          email,
          password,
          permissions: adminUserFormPermissions,
        });
        setActionMessage('Admin creado');
      }

      await loadData();
      resetAdminUserForm();
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo guardar el admin');
    }
  }

  const normalizedWithdrawalsSearch = withdrawalsSearch.trim().toLowerCase();
  const normalizedOrdersSearch = ordersSearch.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = ordersStatusFilter === 'all' || order.status === ordersStatusFilter;
    if (!matchesStatus) {
      return false;
    }

    if (!normalizedOrdersSearch) {
      return true;
    }

    const searchableText = [
      order.customer_name,
      order.customer_email,
      order.courier_name ?? '',
      order.items_summary ?? '',
      formatOrderStatusLabel(order.status),
      formatDeliveryMethodLabel(order.delivery_method),
      String(order.total_cop),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedOrdersSearch);
  });
  const ordersTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE));
  const ordersPageStart = (ordersPage - 1) * ORDERS_PAGE_SIZE;
  const ordersPageItems = filteredOrders.slice(ordersPageStart, ordersPageStart + ORDERS_PAGE_SIZE);

  useEffect(() => {
    if (ordersPage > ordersTotalPages) {
      setOrdersPage(ordersTotalPages);
    }
  }, [ordersPage, ordersTotalPages]);

  const orderStatusFilters: Array<{ key: 'all' | AdminOrderRow['status']; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'pending_payment', label: 'Pendiente de pago' },
    { key: 'paid', label: 'Pagadas' },
    { key: 'confirmed', label: 'Confirmadas' },
    { key: 'assigned', label: 'Asignadas' },
    { key: 'picked_up', label: 'Recogidas' },
    { key: 'on_the_way', label: 'En camino' },
    { key: 'delivered', label: 'Entregadas' },
  ];

  const rawMonthlyStats = overview?.monthlyStats ?? [];
  const activeMonthlyStats = rawMonthlyStats.filter(
    (month) => month.incomeCop > 0 || month.expensesCop > 0 || month.paidCop > 0 || month.payableCop > 0 || month.walletPaymentsCop > 0,
  );
  const displayedMonthlyStats = activeMonthlyStats.length > 0 ? activeMonthlyStats : rawMonthlyStats;

  const homeMonthsTotalPages = Math.max(1, Math.ceil(displayedMonthlyStats.length / HOME_MONTHS_PAGE_SIZE));
  const homeMonthsPageStart = (homeMonthsPage - 1) * HOME_MONTHS_PAGE_SIZE;
  const homeMonthsItems = displayedMonthlyStats.slice(homeMonthsPageStart, homeMonthsPageStart + HOME_MONTHS_PAGE_SIZE);

  const homeWalletTotalPages = Math.max(1, Math.ceil((overview?.adminWalletMovements.length ?? 0) / HOME_WALLET_PAGE_SIZE));
  const homeWalletPageStart = (homeWalletPage - 1) * HOME_WALLET_PAGE_SIZE;
  const homeWalletItems = (overview?.adminWalletMovements ?? []).slice(homeWalletPageStart, homeWalletPageStart + HOME_WALLET_PAGE_SIZE);

  useEffect(() => {
    if (homeMonthsPage > homeMonthsTotalPages) {
      setHomeMonthsPage(homeMonthsTotalPages);
    }
  }, [homeMonthsPage, homeMonthsTotalPages]);

  useEffect(() => {
    if (homeWalletPage > homeWalletTotalPages) {
      setHomeWalletPage(homeWalletTotalPages);
    }
  }, [homeWalletPage, homeWalletTotalPages]);

  const normalizedInventorySearch = inventorySearch.trim().toLowerCase();
  const filteredInventoryProducts = products.filter((product) => product.name.toLowerCase().includes(normalizedInventorySearch));
  const inventoryTotalPages = Math.max(1, Math.ceil(filteredInventoryProducts.length / INVENTORY_PAGE_SIZE));
  const inventoryPageStart = (inventoryPage - 1) * INVENTORY_PAGE_SIZE;
  const inventoryPageItems = filteredInventoryProducts.slice(inventoryPageStart, inventoryPageStart + INVENTORY_PAGE_SIZE);

  useEffect(() => {
    if (inventoryPage > inventoryTotalPages) {
      setInventoryPage(inventoryTotalPages);
    }
  }, [inventoryPage, inventoryTotalPages]);

  const filteredWithdrawals = withdrawals.filter((withdrawal) => {
    const matchesStatus = withdrawalsStatusFilter === 'all' || withdrawal.status === withdrawalsStatusFilter;
    if (!matchesStatus) {
      return false;
    }

    if (!normalizedWithdrawalsSearch) {
      return true;
    }

    const searchableText = [
      withdrawal.user_name,
      withdrawal.user_email,
      withdrawal.destination ?? '',
      withdrawal.notes ?? '',
      formatWithdrawalStatusLabel(withdrawal.status),
      String(withdrawal.amount_cop),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedWithdrawalsSearch);
  });
  const withdrawalsTotalPages = Math.max(1, Math.ceil(filteredWithdrawals.length / WITHDRAWALS_PAGE_SIZE));
  const withdrawalsPageStart = (withdrawalsPage - 1) * WITHDRAWALS_PAGE_SIZE;
  const withdrawalsPageItems = filteredWithdrawals.slice(withdrawalsPageStart, withdrawalsPageStart + WITHDRAWALS_PAGE_SIZE);

  useEffect(() => {
    if (withdrawalsPage > withdrawalsTotalPages) {
      setWithdrawalsPage(withdrawalsTotalPages);
    }
  }, [withdrawalsPage, withdrawalsTotalPages]);

  function handleAddCommissionLevel() {
    const nextLevel =
      configCommissionLevels.length === 0
        ? 1
        : Math.max(...configCommissionLevels.map((level) => Number(level.level))) + 1;

    setConfigCommissionLevels((current) => [
      ...current,
      {
        level: nextLevel,
        amountCop: 0,
        enabled: true,
      },
    ]);
  }

  function handleRemoveCommissionLevel(indexToRemove: number) {
    setConfigCommissionLevels((current) => current.filter((_, index) => index !== indexToRemove));
  }

  async function handleLoadNetwork() {
    const code = networkCode.trim().toUpperCase();
    if (!code) {
      setActionMessage('Ingresa un codigo de referido para consultar la red');
      return;
    }

    setActionMessage(null);
    try {
      const user = await getUserByReferralCode(code);
      const network = await getReferralNetwork(user.id);
      setNetworkData(network);
      setActionMessage('Red cargada');
    } catch (actionError) {
      setNetworkData(null);
      setActionMessage(actionError instanceof Error ? actionError.message : 'No se pudo consultar la red');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <section className="app-card overflow-hidden p-0">
          <div className="bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-5 text-white">
            <div className="skeleton-shimmer h-3 w-28 rounded bg-white/35" />
            <div className="skeleton-shimmer mt-3 h-7 w-56 rounded bg-white/45" />
            <div className="skeleton-shimmer mt-2 h-3 w-72 rounded bg-white/35" />
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`admin-kpi-skeleton-${index}`} className="rounded-2xl bg-[var(--surface-50)] p-3">
                <div className="skeleton-shimmer h-3 w-16 rounded bg-[var(--line)]" />
                <div className="skeleton-shimmer mt-2 h-6 w-14 rounded bg-[var(--line)]" />
              </div>
            ))}
          </div>
        </section>

        <section className="app-card p-4">
          <div className="skeleton-shimmer mb-3 h-5 w-48 rounded bg-[var(--line)]" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`admin-list-skeleton-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                <div className="skeleton-shimmer h-4 w-40 rounded bg-[var(--line)]" />
                <div className="skeleton-shimmer mt-2 h-3 w-24 rounded bg-[var(--line)]" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (error || (section === 'home' && !overview)) {
    return (
      <div className="app-card border-red-200 bg-red-50 p-4 text-red-700">
        Error cargando panel admin: {error ?? 'Sin datos'}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 lg:pb-32">
      {section === 'home' ? (
      <section className="space-y-4">
        <div className="app-card overflow-hidden p-0">
          <div className="bg-[linear-gradient(120deg,#114a7d,#1f5f96,#29b394)] px-4 py-5 text-white sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">Panel admin</p>
            <h2 className="mt-2 text-2xl font-semibold">Centro financiero</h2>
            <p className="mt-1 text-sm text-white/80">Control mensual de ingresos, egresos, cartera por cobrar y wallet administrativa.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Ingresos facturados</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(overview.totalSalesCop)}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Egresos</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(overview.totalExpensesCop)}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Retiros pagados</p>
              <h3 className="mt-1 text-sm font-semibold text-emerald-700">{formatCop(overview.totalPaidCop)}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Retiros por pagar</p>
              <h3 className="mt-1 text-sm font-semibold text-amber-700">{formatCop(overview.totalPayableCop)}</h3>
              <p className="mt-1 text-[10px] text-[var(--muted)]">Solo solicitudes de retiro pendientes.</p>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Utilidad neta</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(overview.totalSalesCop - overview.totalExpensesCop)}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Saldo total billeteras</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(overview.totalWalletsBalanceCop)}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Wallet admin</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(overview.adminWalletBalanceCop)}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Usuarios</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--ink)]">{overview.users}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Órdenes</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--ink)]">{overview.orders}</h3>
            </article>
            <article className="rounded-2xl bg-[var(--surface-50)] p-3">
              <p className="text-[11px] text-[var(--muted)]">Pendientes</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--ink)]">{overview.pendingDeliveries}</h3>
            </article>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="app-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">Estadísticas mensuales</h3>
              <span className="text-xs text-[var(--muted)]">Página {homeMonthsPage} de {homeMonthsTotalPages}</span>
            </div>

            <div className="space-y-2 md:hidden">
              {homeMonthsItems.map((month) => (
                <article key={`mobile-${month.month}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] p-3 text-xs">
                  <p className="font-semibold text-[var(--ink)]">{formatMonthLabel(month.month)}</p>
                  <p className="mt-1 text-[var(--muted)]">Ingresos: <span className="font-semibold text-[var(--ink)]">{formatCop(month.incomeCop)}</span></p>
                  <p className="text-[var(--muted)]">Egresos: <span className="font-semibold text-[var(--ink)]">{formatCop(month.expensesCop)}</span></p>
                  <p className="text-[var(--muted)]">Retiros pagados: <span className="font-semibold text-emerald-700">{formatCop(month.paidCop)}</span></p>
                  <p className="text-[var(--muted)]">Retiros por pagar: <span className="font-semibold text-amber-700">{formatCop(month.payableCop)}</span></p>
                  <p className="text-[var(--muted)]">Wallet admin: <span className="font-semibold text-[var(--ink)]">{formatCop(month.walletPaymentsCop)}</span></p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    <th className="px-2 py-2">Mes</th>
                    <th className="px-2 py-2">Ingresos</th>
                    <th className="px-2 py-2">Egresos</th>
                    <th className="px-2 py-2">Retiros pagados</th>
                    <th className="px-2 py-2">Retiros por pagar</th>
                    <th className="px-2 py-2">Entradas wallet admin</th>
                  </tr>
                </thead>
                <tbody>
                  {homeMonthsItems.map((month) => (
                    <tr key={month.month} className="border-b border-[var(--line)] last:border-b-0">
                      <td className="px-2 py-2 font-semibold text-[var(--ink)]">{formatMonthLabel(month.month)}</td>
                      <td className="px-2 py-2 text-[var(--ink)]">{formatCop(month.incomeCop)}</td>
                      <td className="px-2 py-2 text-[var(--ink)]">{formatCop(month.expensesCop)}</td>
                      <td className="px-2 py-2 text-[var(--ink)]">{formatCop(month.paidCop)}</td>
                      <td className="px-2 py-2 text-[var(--ink)]">{formatCop(month.payableCop)}</td>
                      <td className="px-2 py-2 text-[var(--ink)]">{formatCop(month.walletPaymentsCop)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
              <p className="text-xs text-[var(--muted)]">
                Mostrando {displayedMonthlyStats.length === 0 ? 0 : homeMonthsPageStart + 1}-{Math.min(homeMonthsPageStart + HOME_MONTHS_PAGE_SIZE, displayedMonthlyStats.length)} de {displayedMonthlyStats.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHomeMonthsPage((current) => Math.max(1, current - 1))}
                  disabled={homeMonthsPage === 1}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setHomeMonthsPage((current) => Math.min(homeMonthsTotalPages, current + 1))}
                  disabled={homeMonthsPage >= homeMonthsTotalPages}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </article>

          <article className="app-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">Wallet admin</h3>
              <span className="text-xs text-[var(--muted)]">Página {homeWalletPage} de {homeWalletTotalPages}</span>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Saldo acumulado</p>
              <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{formatCop(overview.adminWalletBalanceCop)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Comisiones: {formatCop(overview.totalCommissionsCop)} | Retiros aprobados: {formatCop(overview.totalApprovedWithdrawalsCop)}</p>
            </div>

            <ul className="mt-3 space-y-2">
              {overview.adminWalletMovements.length === 0 ? (
                <li className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2 text-xs text-[var(--muted)]">No hay movimientos de wallet admin registrados.</li>
              ) : (
                homeWalletItems.map((movement) => (
                  <li key={movement.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[var(--ink)]">{formatAdminWalletMovementType(movement.type)}</p>
                        <p className="text-[11px] text-[var(--muted)]">{movement.sourceUserName ? `Usuario: ${movement.sourceUserName}` : 'Usuario no disponible'}</p>
                        {movement.orderId ? <p className="text-[11px] text-[var(--muted)]">Orden: {movement.orderId.slice(0, 8).toUpperCase()}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-emerald-700">+{formatCop(movement.amountCop)}</p>
                        <p className="text-[11px] text-[var(--muted)]">{formatDateTime(movement.createdAt)}</p>
                      </div>
                    </div>
                    {movement.notes ? <p className="mt-1 text-[11px] text-[var(--muted)]">{movement.notes}</p> : null}
                  </li>
                ))
              )}
            </ul>

            {overview.adminWalletMovements.length > 0 ? (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
                <p className="text-xs text-[var(--muted)]">
                  Mostrando {homeWalletPageStart + 1}-{Math.min(homeWalletPageStart + HOME_WALLET_PAGE_SIZE, overview.adminWalletMovements.length)} de {overview.adminWalletMovements.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHomeWalletPage((current) => Math.max(1, current - 1))}
                    disabled={homeWalletPage === 1}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeWalletPage((current) => Math.min(homeWalletTotalPages, current + 1))}
                    disabled={homeWalletPage >= homeWalletTotalPages}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        </div>

        <div className="grid gap-2 border-t border-[var(--line)] p-4 sm:grid-cols-3">
          <a href="/admin/orders" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)]">
            Ver pedidos
          </a>
          <a href="/admin/inventory" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)]">
            Gestionar inventario
          </a>
          <a href="/admin/withdrawals" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)]">
            Gestionar retiros
          </a>
        </div>
        <div className="grid gap-2 border-t border-[var(--line)] p-4 sm:grid-cols-3">
          <a href="/admin/config" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)]">
            Ajustes del sistema
          </a>
        </div>
      </section>
      ) : null}

      {actionMessage ? <div className="app-card px-4 py-3 text-sm text-[var(--ink)]">{actionMessage}</div> : null}

      {section === 'orders' ? (
      <section className="app-card p-4">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)]">Órdenes</h3>
            <p className="text-xs text-[var(--muted)]">Panel profesional con búsqueda, estado y paginación.</p>
          </div>
          <span className="rounded-full bg-[var(--surface-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{filteredOrders.length} registros</span>
        </div>

        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Buscar orden</span>
            <input
              type="text"
              value={ordersSearch}
              onChange={(event) => {
                setOrdersSearch(event.target.value);
                setOrdersPage(1);
              }}
              className="app-input"
              placeholder="Cliente, correo, estado, repartidor, monto"
            />
          </label>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {orderStatusFilters.map((filterOption) => (
            <button
              key={filterOption.key}
              type="button"
              onClick={() => {
                setOrdersStatusFilter(filterOption.key);
                setOrdersPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                ordersStatusFilter === filterOption.key
                  ? 'bg-[var(--ink)] text-white'
                  : 'border border-[var(--line)] bg-white text-[var(--muted)]'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        {orders.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay órdenes registradas.</p>
        ) : filteredOrders.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay órdenes para el filtro o búsqueda actual.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {ordersPageItems.map((order) => (
                <li key={order.id} className="rounded-2xl border border-[var(--line)] bg-white p-3">
                  {(() => {
                    const isPendingPayment = order.status === 'pending_payment';
                    const hasPendingBalance = order.pending_payment_cop > 0;
                    const requiresProofReview = hasPendingBalance && requiresPaymentProof(order.payment_method);
                    const canAssignCourier =
                      order.delivery_method === 'home_delivery' && (order.status === 'confirmed' || (isPendingPayment && isHomeDeliveryCashOrder(order)));
                    const canApprovePayment =
                      hasPendingBalance && (!isHomeDeliveryCashOrder(order) || order.status !== 'pending_payment');
                    const hasPaymentProof = Boolean(order.payment_proof_data_url);

                    return (
                      <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-[var(--ink)]">{order.customer_name}</strong>
                      <p className="truncate text-xs text-[var(--muted)]">{order.customer_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Pedido {order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm font-semibold text-[var(--accent)]">{formatCop(order.total_cop)}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                    <span className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.08em] ${getOrderStatusTone(order.status)}`}>
                      {formatOrderStatusLabel(order.status)}
                    </span>
                    <span className="rounded-full bg-[var(--surface-50)] px-2.5 py-1">{formatDeliveryMethodLabel(order.delivery_method)}</span>
                    <span className="rounded-full bg-[var(--surface-50)] px-2.5 py-1">Pago: {formatPaymentMethodLabel(order.payment_method)}</span>
                    {order.delivery_method === 'home_delivery' ? (
                      <span className="rounded-full bg-[var(--surface-50)] px-2.5 py-1">Domicilio: {formatCop(order.delivery_fee_cop ?? 0)}</span>
                    ) : null}
                    {order.courier_name ? <span className="rounded-full bg-[var(--surface-50)] px-2.5 py-1">Repartidor: {order.courier_name}</span> : null}
                    <span className="rounded-full bg-[var(--surface-50)] px-2.5 py-1">{formatDateTime(order.created_at)}</span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">
                    <span className="font-semibold text-[var(--ink)]">Carrito:</span>{' '}
                    {order.items_summary?.trim() ? order.items_summary : 'Sin detalle de items'}
                  </p>

                  <div className="mt-3 grid gap-2 lg:grid-cols-[1.3fr_1fr]">
                    <div className={`rounded-xl border px-3 py-2 text-xs ${requiresProofReview ? getPaymentProofTone(order.payment_proof_status) : 'border-[var(--line)] bg-[var(--surface-50)] text-[var(--muted)]'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Pago y comprobante</p>
                        <span className="rounded-full border border-current/20 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                          {requiresProofReview ? formatPaymentProofStatusLabel(order.payment_proof_status) : 'No requiere revision'}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px]">
                        {requiresProofReview
                          ? 'El comprobante se revisa en esta misma tarjeta del pedido.'
                          : 'Pedido gestionado sin revision manual de comprobante.'}
                      </p>

                      {requiresProofReview && order.payment_proof_uploaded_at ? <p className="mt-1 text-[11px]">Subido: {formatDateTime(order.payment_proof_uploaded_at)}</p> : null}
                      {requiresProofReview && order.payment_proof_rejection_reason ? <p className="mt-1 text-[11px] font-medium text-rose-700">Motivo: {order.payment_proof_rejection_reason}</p> : null}

                      {requiresProofReview ? (
                        hasPaymentProof ? (
                          <button
                            type="button"
                            onClick={() => openProofPreviewModal(order.id, order.payment_proof_data_url ?? '')}
                            className="mt-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                          >
                            Ver comprobante aqui
                          </button>
                        ) : (
                          <p className="mt-2 font-medium">Aun sin comprobante adjunto.</p>
                        )
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Accion recomendada</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{getAdminOrderNextAction(order).title}</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {canApprovePayment ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleConfirmPayment(order.id)}
                              disabled={requiresProofReview && !hasPaymentProof}
                              className="rounded-full bg-[#163b2d] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                              title={requiresProofReview && !hasPaymentProof ? 'No se puede confirmar: falta comprobante' : 'Confirmar pago'}
                            >
                              Aprobar pago
                            </button>
                            {requiresProofReview ? (
                              <button type="button" onClick={() => handleRejectPayment(order.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                                Rechazar
                              </button>
                            ) : null}
                          </>
                        ) : null}

                        {order.status === 'paid' ? (
                          <button type="button" onClick={() => handleConfirmOrder(order.id)} className="rounded-full bg-[#2b8a6d] px-3 py-1.5 text-xs font-semibold text-white">
                            Validar pedido
                          </button>
                        ) : null}

                        {canAssignCourier ? (
                          <>
                            <select
                              value={courierByOrder[order.id] ?? ''}
                              onChange={(event) =>
                                setCourierByOrder((current) => ({
                                  ...current,
                                  [order.id]: event.target.value,
                                }))
                              }
                              className="app-input py-2 text-xs"
                            >
                              <option value="">Selecciona repartidor</option>
                              {couriers.map((courier) => (
                                <option key={courier.id} value={courier.id}>
                                  {courier.full_name}
                                </option>
                              ))}
                            </select>
                            <button type="button" onClick={() => handleAssignCourier(order.id)} className="rounded-full bg-[#c8d95e] px-3 py-1.5 text-xs font-semibold text-[#181b19]">
                              Asignar a ruta
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
              <p className="text-xs text-[var(--muted)]">
                Mostrando {filteredOrders.length === 0 ? 0 : ordersPageStart + 1}-{Math.min(ordersPageStart + ORDERS_PAGE_SIZE, filteredOrders.length)} de {filteredOrders.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrdersPage((current) => Math.max(1, current - 1))}
                  disabled={ordersPage === 1}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-xs font-semibold text-[var(--muted)]">Página {ordersPage} de {ordersTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setOrdersPage((current) => Math.min(ordersTotalPages, current + 1))}
                  disabled={ordersPage >= ordersTotalPages}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      ) : null}

      {proofPreviewModal ? (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-black/55 p-4" onClick={closeProofPreviewModal}>
          <div
            className="w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Comprobante</p>
                <p className="text-sm font-semibold text-[var(--ink)]">Pedido {proofPreviewModal.orderId.slice(0, 8).toUpperCase()}</p>
              </div>
              <button
                type="button"
                onClick={closeProofPreviewModal}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[78vh] overflow-auto bg-[var(--surface-50)] p-3">
              <img
                src={proofPreviewModal.imageUrl}
                alt="Comprobante de pago"
                className="mx-auto h-auto max-h-[72vh] w-auto rounded-2xl border border-[var(--line)] bg-white object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      {section === 'inventory' ? (
      <section className="app-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)]">Inventario</h3>
            <p className="text-xs text-[var(--muted)]">Administra productos con CRUD desde modales.</p>
          </div>
          <button
            type="button"
            onClick={openCreateProductModal}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Nuevo producto
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Buscar producto</span>
            <input
              type="text"
              value={inventorySearch}
              onChange={(event) => {
                setInventorySearch(event.target.value);
                setInventoryPage(1);
              }}
              className="app-input"
              placeholder="Nombre del producto"
            />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {products.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No hay productos registrados.</p>
          ) : filteredInventoryProducts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No hay resultados para la búsqueda actual.</p>
          ) : (
            inventoryPageItems.map((product) => (
                <article key={product.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{product.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">ID: {product.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <strong className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">{formatCop(product.priceCop)}</strong>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)]">Stock: {product.stock}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditProductModal(product)}
                        aria-label={`Editar ${product.name}`}
                        title="Editar"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] transition-colors hover:bg-[var(--surface-100)]"
                      >
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteProductModal(product)}
                        aria-label={`Eliminar ${product.name}`}
                        title="Eliminar"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </article>
              ))
          )}
        </div>

        {filteredInventoryProducts.length > 0 ? (
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
            <p className="text-xs text-[var(--muted)]">
              Mostrando {filteredInventoryProducts.length === 0 ? 0 : inventoryPageStart + 1}-{Math.min(inventoryPageStart + INVENTORY_PAGE_SIZE, filteredInventoryProducts.length)} de {filteredInventoryProducts.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInventoryPage((current) => Math.max(1, current - 1))}
                disabled={inventoryPage === 1}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-xs font-semibold text-[var(--muted)]">Página {inventoryPage} de {inventoryTotalPages}</span>
              <button
                type="button"
                onClick={() => setInventoryPage((current) => Math.min(inventoryTotalPages, current + 1))}
                disabled={inventoryPage >= inventoryTotalPages}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}

        {inventoryModalMode ? (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" onClick={closeInventoryModal}>
            <div
              className="w-full max-w-xl rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
              onClick={(event) => event.stopPropagation()}
            >
              {inventoryModalMode === 'delete' ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Inventario</p>
                    <h4 className="mt-1 text-xl font-semibold text-[var(--ink)]">Eliminar producto</h4>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Vas a eliminar <strong className="text-[var(--ink)]">{inventorySelectedProduct?.name}</strong>. Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeInventoryModal}
                      disabled={inventoryActionLoading}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteProduct}
                      disabled={inventoryActionLoading}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ef5d5d] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                      {inventoryActionLoading ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmitInventoryModal();
                  }}
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Inventario</p>
                    <h4 className="mt-1 text-xl font-semibold text-[var(--ink)]">
                      {inventoryModalMode === 'create' ? 'Crear producto' : 'Editar producto'}
                    </h4>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Nombre</span>
                    <input
                      type="text"
                      value={inventoryFormName}
                      onChange={(event) => setInventoryFormName(event.target.value)}
                      className="app-input"
                      placeholder="Ej: Combo nutrición"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Precio (COP)</span>
                    <input
                      type="number"
                      min={0}
                      value={inventoryFormPrice}
                      onChange={(event) => setInventoryFormPrice(event.target.value)}
                      className="app-input"
                    />
                  </label>

                  {inventoryModalMode === 'create' ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Stock inicial</span>
                      <input
                        type="number"
                        min={0}
                        value={inventoryFormStock}
                        onChange={(event) => setInventoryFormStock(event.target.value)}
                        className="app-input"
                      />
                    </label>
                  ) : (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Ajuste de stock (entero)</span>
                      <input
                        type="number"
                        value={inventoryFormStockDelta}
                        onChange={(event) => setInventoryFormStockDelta(event.target.value)}
                        className="app-input"
                        placeholder="Ej: 5 o -3"
                      />
                      <span className="text-xs text-[var(--muted)]">Stock actual: {inventorySelectedProduct?.stock ?? 0}</span>
                    </label>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeInventoryModal}
                      disabled={inventoryActionLoading}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={inventoryActionLoading}
                      className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {inventoryActionLoading ? 'Guardando...' : inventoryModalMode === 'create' ? 'Crear producto' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      {section === 'withdrawals' ? (
      <section className="app-card p-4">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)]">Solicitudes de retiro</h3>
            <p className="text-xs text-[var(--muted)]">Vista limpia con filtro por estado y paginación.</p>
          </div>
          <span className="rounded-full bg-[var(--surface-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{filteredWithdrawals.length} registros</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendientes' },
            { key: 'approved', label: 'Aprobados' },
            { key: 'rejected', label: 'Rechazados' },
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              type="button"
              onClick={() => {
                setWithdrawalsStatusFilter(filterOption.key as 'all' | 'pending' | 'approved' | 'rejected');
                setWithdrawalsPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                withdrawalsStatusFilter === filterOption.key
                  ? 'bg-[var(--ink)] text-white'
                  : 'border border-[var(--line)] bg-white text-[var(--muted)]'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Buscar retiro</span>
            <input
              type="text"
              value={withdrawalsSearch}
              onChange={(event) => {
                setWithdrawalsSearch(event.target.value);
                setWithdrawalsPage(1);
              }}
              className="app-input"
              placeholder="Nombre, correo, destino, nota o monto"
            />
          </label>
        </div>

        {withdrawals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay retiros registrados por ahora.</p>
        ) : filteredWithdrawals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay retiros para los filtros o búsqueda actual.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {withdrawalsPageItems.map((withdrawal) => (
                <li key={withdrawal.id} className="rounded-2xl border border-[var(--line)] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink)]">{withdrawal.user_name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{withdrawal.user_email}</p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--accent)]">{formatCop(withdrawal.amount_cop)}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-1 font-semibold uppercase tracking-[0.12em] ${getWithdrawalStatusTone(withdrawal.status)}`}>
                      {formatWithdrawalStatusLabel(withdrawal.status)}
                    </span>
                    <span className="text-[var(--muted)]">{formatDateTime(withdrawal.created_at)}</span>
                    {withdrawal.destination ? <span className="text-[var(--muted)]">Destino: {withdrawal.destination}</span> : null}
                  </div>

                  {withdrawal.notes ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">Nota: {withdrawal.notes}</p>
                  ) : null}
                  {withdrawal.reviewed_by_name ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">Revisó: {withdrawal.reviewed_by_name}</p>
                  ) : null}

                  {withdrawal.status === 'pending' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleReviewWithdrawal(withdrawal.id, 'approved')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                      >
                        <IconCheck className="h-3.5 w-3.5" />
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewWithdrawal(withdrawal.id, 'rejected')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                      >
                        <IconX className="h-3.5 w-3.5" />
                        Rechazar
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
              <p className="text-xs text-[var(--muted)]">
                Mostrando {filteredWithdrawals.length === 0 ? 0 : withdrawalsPageStart + 1}-{Math.min(withdrawalsPageStart + WITHDRAWALS_PAGE_SIZE, filteredWithdrawals.length)} de {filteredWithdrawals.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawalsPage((current) => Math.max(1, current - 1))}
                  disabled={withdrawalsPage === 1}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-xs font-semibold text-[var(--muted)]">Página {withdrawalsPage} de {withdrawalsTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setWithdrawalsPage((current) => Math.min(withdrawalsTotalPages, current + 1))}
                  disabled={withdrawalsPage >= withdrawalsTotalPages}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      ) : null}

      {section === 'config' ? (
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="app-card overflow-hidden p-0 lg:col-span-3">
          <div className="bg-[linear-gradient(135deg,#103652,#1f5f96,#29b394)] px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">Configuración profesional</p>
                <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">Controla reglas, comisiones y accesos desde un solo lugar</h3>
                <p className="mt-2 max-w-xl text-sm text-white/78">Ajusta el sistema MLM, crea administradores con permisos limitados y revisa la red de referidos sin perder contexto.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/65">Generaciones</p>
                  <p className="mt-1 font-semibold">{systemConfig?.commissionLevels.length ?? configCommissionLevels.length}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/65">Admins</p>
                  <p className="mt-1 font-semibold">{adminUsers.length}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/65">Retiro mínimo</p>
                  <p className="mt-1 font-semibold">
                    {formatCop(Number(minWithdrawalCop || (systemConfig?.minWithdrawalCop ?? 0)))}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/65">Permisos</p>
                  <p className="mt-1 font-semibold">Granulares</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/65">Pagos activos</p>
                  <p className="mt-1 font-semibold">{enabledPaymentMethods.length}</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="app-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[var(--ink)]">Configuración MLM</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleResetConfigForm} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]">
                Restaurar
              </button>
              <button type="button" onClick={handleSaveConfig} className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white">
                Guardar
              </button>
            </div>
          </div>
          <p className="mb-4 text-xs text-[var(--muted)]">Define reglas globales del sistema, retiros y comisiones por generación.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Días de gracia</span>
              <input
                id="grace-period-days"
                type="number"
                min={0}
                max={30}
                value={gracePeriodDays}
                onChange={(event) => setGracePeriodDays(event.target.value)}
                className="app-input"
                placeholder="Ej: 3"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Retiro mínimo (COP)</span>
              <input
                id="min-withdrawal-cop"
                type="number"
                min={0}
                value={minWithdrawalCop}
                onChange={(event) => setMinWithdrawalCop(event.target.value)}
                className="app-input"
                placeholder="Ej: 50000"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Comisión de delivery (%)</span>
              <input
                id="delivery-commission-percent"
                type="number"
                min={0}
                max={100}
                value={deliveryCommissionPercent}
                onChange={(event) => setDeliveryCommissionPercent(event.target.value)}
                className="app-input"
                placeholder="Ej: 0"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Máximo de generaciones</span>
              <input
                id="max-commission-levels"
                type="number"
                min={1}
                max={20}
                value={maxCommissionLevels}
                onChange={(event) => setMaxCommissionLevels(event.target.value)}
                className="app-input"
                placeholder="Ej: 10"
              />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--ink)]">Comisiones por generación</h4>
              <button type="button" onClick={handleAddCommissionLevel} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]">
                Agregar generación
              </button>
            </div>

            {configCommissionLevels.map((level, index) => (
              <fieldset key={`${level.level}-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Generación {index + 1}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-[0.8fr_1fr_auto]">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Número</span>
                    <input
                      type="number"
                      min={1}
                      value={level.level}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setConfigCommissionLevels((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, level: value } : item)));
                      }}
                      className="app-input"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Bono (COP)</span>
                    <input
                      type="number"
                      min={0}
                      value={level.amountCop}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setConfigCommissionLevels((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, amountCop: value } : item)));
                      }}
                      className="app-input"
                    />
                  </label>

                  <div className="flex items-end gap-2 sm:justify-end">
                    <label className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]">
                      <span>Activa</span>
                      <input
                        type="checkbox"
                        checked={level.enabled}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setConfigCommissionLevels((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, enabled: checked } : item)));
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveCommissionLevel(index)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </fieldset>
            ))}
          </div>

          {systemConfig ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Configuración guardada: {systemConfig.commissionLevels.length} generaciones, retiro mínimo {formatCop(systemConfig.minWithdrawalCop)}, {systemConfig.deliveryCommissionPercent}% de comisión delivery y {systemConfig.enabledPaymentMethods.length} métodos de pago activos.
            </p>
          ) : null}
        </article>

        <article className="app-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Métodos de pago</h3>
              <p className="text-xs text-[var(--muted)]">Nuevo item de configuración para checkout y validación de órdenes.</p>
            </div>
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              {enabledPaymentMethods.length} activos
            </span>
          </div>

          <div className="space-y-2">
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const enabled = enabledPaymentMethods.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex items-start justify-between gap-3 rounded-2xl border px-3 py-2.5 transition ${
                    enabled ? 'border-emerald-200 bg-emerald-50/70' : 'border-[var(--line)] bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink)]">{option.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{option.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => handleTogglePaymentMethod(option.value)}
                    className="mt-1 h-4 w-4 accent-emerald-600"
                  />
                </label>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-[var(--muted)]">
            Los cambios se guardan con el botón Guardar de Configuración MLM.
          </p>
        </article>

        <article className="app-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Usuarios admin</h3>
              <p className="text-xs text-[var(--muted)]">Crea admins con usuario, contraseña y permisos específicos.</p>
            </div>
            <button type="button" onClick={openCreateAdminUserForm} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]">
              Nuevo
            </button>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Nombre completo</span>
              <input
                type="text"
                value={adminUserFormFullName}
                onChange={(event) => setAdminUserFormFullName(event.target.value)}
                className="app-input"
                placeholder="Ej: Ana María Pérez"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Usuario</span>
              <input
                type="text"
                value={adminUserFormUsername}
                onChange={(event) => setAdminUserFormUsername(event.target.value)}
                className="app-input uppercase"
                placeholder="Ej: anaperez"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Correo</span>
              <input
                type="email"
                value={adminUserFormEmail}
                onChange={(event) => setAdminUserFormEmail(event.target.value)}
                className="app-input"
                placeholder="admin@empresa.com"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Contraseña {adminUserEditingId ? '(opcional para editar)' : ''}
              </span>
              <input
                type="password"
                value={adminUserFormPassword}
                onChange={(event) => setAdminUserFormPassword(event.target.value)}
                className="app-input"
                placeholder={adminUserEditingId ? 'Deja en blanco si no quieres cambiarla' : 'Mínimo 8 caracteres'}
              />
            </label>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Permisos</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ADMIN_PERMISSION_OPTIONS.map((permission) => (
                  <label key={permission} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]">
                    <span>{formatAdminPermissionLabel(permission)}</span>
                    <input
                      type="checkbox"
                      checked={adminUserFormPermissions.includes(permission)}
                      onChange={() => handleToggleAdminPermission(permission)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void handleSubmitAdminUser()} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">
                {adminUserEditingId ? 'Actualizar admin' : 'Crear admin'}
              </button>
              {adminUserEditingId ? (
                <button type="button" onClick={resetAdminUserForm} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)]">
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--ink)]">Administradores existentes</h4>
              <span className="text-xs text-[var(--muted)]">{adminUsers.length}</span>
            </div>

            <div className="space-y-2">
              {adminUsers.map((adminUser) => (
                <article key={adminUser.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{adminUser.fullName}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{adminUser.username ?? 'Sin usuario'} · {adminUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditAdminUserForm(adminUser)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)]"
                      aria-label={`Editar admin ${adminUser.fullName}`}
                      title="Editar"
                    >
                      <IconEdit className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {adminUser.permissions.length > 0 ? (
                      adminUser.permissions.map((permission) => (
                        <span key={permission} className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
                          {formatAdminPermissionLabel(permission)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Sin permisos asignados</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="app-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[var(--ink)]">Red de referidos</h3>
            <span className="text-xs text-[var(--muted)]">Consulta</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="w-full space-y-1.5 sm:flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Código de referido</span>
              <input
                id="network-referral-code"
                type="text"
                value={networkCode}
                onChange={(event) => setNetworkCode(event.target.value)}
                className="app-input uppercase"
                placeholder="Ej: ABC123"
              />
            </label>
            <button type="button" onClick={handleLoadNetwork} className="shrink-0 rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-sm font-semibold text-white">
              Ver red
            </button>
          </div>

          {networkData ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[var(--surface-50)] p-3">
                <p className="text-sm font-semibold text-[var(--ink)]">{networkData.root.fullName}</p>
                <p className="text-xs text-[var(--muted)]">Código: {networkData.root.referralCode}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Miembros en red: {networkData.summary.totalMembers}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {networkData.levels.map((level) => (
                  <article key={level.level} className="rounded-2xl bg-[var(--surface-50)] p-3">
                    <p className="text-[11px] text-[var(--muted)]">Nivel {level.level}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">Miembros: {level.count}</p>
                    <p className="text-sm text-[var(--accent)]">{formatCop(level.commissionsCop)}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">Consulta un código para ver su red por niveles.</p>
          )}
        </article>
      </section>
      ) : null}
    </div>
  );
}
