'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/hooks/useDashboard';
import { ProfileSettingsForm } from '@/components/dashboard/profile-settings-form';
import { WalletPanel } from '@/components/dashboard/wallet-panel';
import { confirmCustomerOrderReceipt, getReferralNetworkLevelMembers, getReferralNetworkSummary, getUserOrdersPage } from '@/services/api';
import { clearAuthSession } from '@/services/auth-session';
import { ReferralNetworkLevelMembersPage, ReferralNetworkSummary, UserOrderListItem, UserOrdersPage } from '@/types/domain';

function formatRoleLabel(role: 'admin' | 'customer' | 'courier'): string {
  if (role === 'admin') {
    return 'Administrador';
  }

  if (role === 'courier') {
    return 'Repartidor';
  }

  return 'Cliente';
}

interface DashboardShellProps {
  userId: string;
  focus?: 'home' | 'all' | 'overview' | 'wallet' | 'network' | 'orders' | 'profile';
}

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

const GRACE_DAYS = 3;
const NETWORK_PAGE_SIZE = 25;
const ORDERS_PAGE_SIZE = 12;

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(date);
}

function SkeletonBar({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

function DashboardLoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[radial-gradient(120%_120%_at_0%_0%,#1f5f96_0%,#1a4474_45%,#132e4f_100%)] p-5 text-white shadow-[0_20px_60px_rgba(16,42,67,0.22)]">
        <div className="space-y-3">
          <SkeletonBar className="h-3 w-20 bg-white/30" />
          <SkeletonBar className="h-10 w-44 bg-white/35" />
          <SkeletonBar className="h-3 w-32 bg-white/30" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SkeletonBar className="h-8 w-full rounded-full bg-white/25" />
            <SkeletonBar className="h-8 w-full rounded-full bg-white/25" />
            <SkeletonBar className="h-8 w-full rounded-full bg-white/25" />
            <SkeletonBar className="h-8 w-full rounded-full bg-white/25" />
          </div>
        </div>
      </section>

      <section className="app-card rounded-2xl p-5">
        <div className="space-y-3">
          <SkeletonBar className="h-4 w-40" />
          <SkeletonBar className="h-2 w-full rounded-full" />
          <div className="grid gap-2 sm:grid-cols-2">
            <SkeletonBar className="h-14 w-full rounded-xl" />
            <SkeletonBar className="h-14 w-full rounded-xl" />
          </div>
          <SkeletonBar className="h-10 w-full rounded-xl" />
        </div>
      </section>

      <section className="app-card rounded-2xl p-4">
        <SkeletonBar className="h-4 w-28" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SkeletonBar className="h-10 w-full rounded-xl" />
          <SkeletonBar className="h-10 w-full rounded-xl" />
          <SkeletonBar className="h-10 w-full rounded-xl" />
          <SkeletonBar className="h-10 w-full rounded-xl" />
        </div>
      </section>
    </div>
  );
}

function formatOrderStatusLabel(status: UserOrderListItem['status']): string {
  const labels: Record<UserOrderListItem['status'], string> = {
    pending_payment: 'Pendiente de pago',
    paid: 'Pagada',
    confirmed: 'Confirmada',
    assigned: 'Asignada a repartidor',
    picked_up: 'Recogida por repartidor',
    on_the_way: 'En camino',
    delivered: 'Entregada',
  };

  return labels[status] ?? status.replaceAll('_', ' ');
}

function formatDeliveryMethodLabel(method: UserOrderListItem['deliveryMethod']): string {
  const labels: Record<UserOrderListItem['deliveryMethod'], string> = {
    pickup: 'Recoger en tienda',
    home_delivery: 'Domicilio',
  };

  return labels[method] ?? method;
}

function formatPaymentMethodLabel(method: UserOrderListItem['paymentMethod']): string {
  const labels: Record<UserOrderListItem['paymentMethod'], string> = {
    wallet: 'Billetera',
    bank_transfer: 'Transferencia bancaria',
    mobile_payment: 'Pago móvil',
    cash: 'Efectivo',
    cash_on_delivery: 'Efectivo',
  };

  return labels[method] ?? method;
}

function getOrderStatusTone(status: UserOrderListItem['status']): string {
  switch (status) {
    case 'pending_payment':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'paid':
    case 'confirmed':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'assigned':
    case 'picked_up':
    case 'on_the_way':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-[var(--surface-50)] text-[var(--muted)] border-[var(--line)]';
  }
}

export function DashboardShell({ userId, focus = 'home' }: DashboardShellProps) {
  const { loading, data, error } = useDashboard(userId);
  const router = useRouter();
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [networkSummary, setNetworkSummary] = useState<ReferralNetworkSummary | null>(null);
  const [networkLevelsMembers, setNetworkLevelsMembers] = useState<Record<number, ReferralNetworkLevelMembersPage>>({});
  const [networkLevelsLoading, setNetworkLevelsLoading] = useState<Record<number, boolean>>({});
  const [networkLevelsError, setNetworkLevelsError] = useState<Record<number, string | null>>({});
  const [selectedNetworkLevel, setSelectedNetworkLevel] = useState<number | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [ordersPageData, setOrdersPageData] = useState<UserOrdersPage | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersSearchTerm, setOrdersSearchTerm] = useState('');
  const [confirmingReceiptOrderId, setConfirmingReceiptOrderId] = useState<string | null>(null);
  const [confirmReceiptModalOrderId, setConfirmReceiptModalOrderId] = useState<string | null>(null);
  const [ordersActionMessage, setOrdersActionMessage] = useState<string | null>(null);
  const networkLevelsLoadingRef = useRef<Record<number, boolean>>({});
  const networkLevelSentinelRef = useRef<HTMLDivElement | null>(null);
  const ordersSentinelRef = useRef<HTMLDivElement | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const currentDayRef = useRef<HTMLDivElement | null>(null);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const show = (section: Exclude<DashboardShellProps['focus'], 'all'>) => focus === 'all' || focus === section;
  const levelNumbers = (networkSummary?.levels ?? []).map((level) => level.level);

  useEffect(() => {
    if (loading || error || !data) {
      return;
    }

    if (data.user.role !== 'customer' || focus !== 'home') {
      return;
    }

    const calendar = calendarScrollRef.current;
    const todayElement = currentDayRef.current;

    if (!calendar || !todayElement) {
      return;
    }

    const targetLeft = todayElement.offsetLeft - calendar.clientWidth / 2 + todayElement.clientWidth / 2;
    calendar.scrollTo({
      left: Math.max(targetLeft, 0),
      behavior: 'smooth',
    });
  }, [loading, error, data, focus, currentYear, currentMonth]);

  useEffect(() => {
    if (loading || error || !data || data.user.role !== 'customer') {
      return;
    }

    let isMounted = true;
    setNetworkLoading(true);
    setNetworkError(null);
    setNetworkLevelsMembers({});
    setNetworkLevelsLoading({});
    setNetworkLevelsError({});
    setSelectedNetworkLevel(null);

    getReferralNetworkSummary(userId)
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setNetworkSummary(response);
      })
      .catch((networkLoadError: Error) => {
        if (!isMounted) {
          return;
        }
        setNetworkSummary(null);
        setNetworkError(networkLoadError.message || 'No se pudo cargar tu red');
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
        setNetworkLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loading, error, data, userId]);

  const loadNetworkLevelMembers = (level: number, page = 1, append = false) => {
    if (networkLevelsLoadingRef.current[level]) {
      return;
    }

    networkLevelsLoadingRef.current = {
      ...networkLevelsLoadingRef.current,
      [level]: true,
    };

    setNetworkLevelsLoading((current) => ({
      ...current,
      [level]: true,
    }));
    setNetworkLevelsError((current) => ({
      ...current,
      [level]: null,
    }));

    getReferralNetworkLevelMembers(userId, level, page, NETWORK_PAGE_SIZE)
      .then((response) => {
        setNetworkLevelsMembers((current) => ({
          ...current,
          [level]:
            append && current[level]
              ? {
                  ...response,
                  members: [...current[level].members, ...response.members],
                }
              : response,
        }));
      })
      .catch((networkLevelError: Error) => {
        setNetworkLevelsError((current) => ({
          ...current,
          [level]: networkLevelError.message || 'No se pudo cargar esta generación',
        }));
      })
      .finally(() => {
        networkLevelsLoadingRef.current = {
          ...networkLevelsLoadingRef.current,
          [level]: false,
        };
        setNetworkLevelsLoading((current) => ({
          ...current,
          [level]: false,
        }));
      });
  };

  const loadOrdersPage = (page = 1, append = false) => {
    if ((append && ordersLoadingMore) || (!append && ordersLoading)) {
      return;
    }

    if (append) {
      setOrdersLoadingMore(true);
    } else {
      setOrdersLoading(true);
      setOrdersError(null);
    }

    getUserOrdersPage(userId, page, ORDERS_PAGE_SIZE)
      .then((response) => {
        setOrdersPageData((current) => {
          if (!append || !current) {
            return response;
          }

          const deduped = response.orders.filter(
            (incoming) => !current.orders.some((existing) => existing.id === incoming.id),
          );

          return {
            ...response,
            orders: [...current.orders, ...deduped],
          };
        });
      })
      .catch((ordersLoadError: Error) => {
        setOrdersError(ordersLoadError.message || 'No se pudieron cargar tus órdenes');
      })
      .finally(() => {
        if (append) {
          setOrdersLoadingMore(false);
        } else {
          setOrdersLoading(false);
        }
      });
  };

  useEffect(() => {
    setOrdersPageData(null);
    setOrdersError(null);
    setOrdersLoading(false);
    setOrdersLoadingMore(false);
    setOrdersSearchTerm('');
    setConfirmReceiptModalOrderId(null);
    setConfirmingReceiptOrderId(null);
    setOrdersActionMessage(null);
  }, [userId]);

  useEffect(() => {
    if (loading || error || !data || data.user.role !== 'customer') {
      return;
    }

    if (!show('orders')) {
      return;
    }

    if (ordersPageData || ordersLoading) {
      return;
    }

    loadOrdersPage(1);
  }, [loading, error, data, focus, ordersPageData, ordersLoading]);

  useEffect(() => {
    if (!show('orders')) {
      return;
    }

    if (!ordersPageData || !ordersSentinelRef.current) {
      return;
    }

    if (ordersPageData.orders.length >= ordersPageData.total) {
      return;
    }

    const sentinel = ordersSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        if (ordersLoadingMore) {
          return;
        }

        const totalPages = Math.max(1, Math.ceil(ordersPageData.total / ordersPageData.pageSize));
        if (ordersPageData.page >= totalPages) {
          return;
        }

        loadOrdersPage(ordersPageData.page + 1, true);
      },
      {
        root: null,
        rootMargin: '220px 0px',
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [focus, ordersPageData, ordersLoadingMore]);

  useEffect(() => {
    networkLevelsLoadingRef.current = networkLevelsLoading;
  }, [networkLevelsLoading]);

  useEffect(() => {
    if (!selectedNetworkLevel) {
      return;
    }

    const pageData = networkLevelsMembers[selectedNetworkLevel];
    const sentinel = networkLevelSentinelRef.current;

    if (!pageData || !sentinel || pageData.members.length >= pageData.total) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        const latest = networkLevelsMembers[selectedNetworkLevel];
        if (!latest) {
          return;
        }

        const totalPages = Math.max(1, Math.ceil(latest.total / latest.pageSize));
        if (latest.page >= totalPages) {
          return;
        }

        loadNetworkLevelMembers(selectedNetworkLevel, latest.page + 1, true);
      },
      {
        root: null,
        rootMargin: '220px 0px',
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [selectedNetworkLevel, networkLevelsMembers]);

  const copyReferralCode = async (code: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopiedReferral(true);
      window.setTimeout(() => setCopiedReferral(false), 1800);
    } catch {
      setCopiedReferral(false);
    }
  };

  const handleSignOut = () => {
    clearAuthSession();
    router.replace('/login');
  };

  const handleConfirmReceipt = async (orderId: string) => {
    try {
      setConfirmingReceiptOrderId(orderId);
      setOrdersActionMessage(null);
      await confirmCustomerOrderReceipt(orderId);

      setOrdersPageData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: current.orders.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  customerReceivedConfirmedAt: new Date().toISOString(),
                }
              : order,
          ),
        };
      });

      setConfirmReceiptModalOrderId(null);
      setOrdersActionMessage('Recepción confirmada correctamente.');
    } catch (receiptError) {
      setOrdersActionMessage(receiptError instanceof Error ? receiptError.message : 'No se pudo confirmar la recepción');
    } finally {
      setConfirmingReceiptOrderId(null);
    }
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.user.role === 'admin') {
      router.replace('/admin');
      return;
    }

    if (data.user.role === 'courier') {
      router.replace('/courier');
    }
  }, [data, router]);

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (error || !data) {
    const isUnauthorized = Boolean(error && /unauthorized|missing bearer/i.test(error));

    return (
      <div className="app-card border-red-200 bg-red-50 p-4 text-red-700">
        <p>Error cargando dashboard: {error ?? 'Sin datos'}</p>
        {isUnauthorized ? (
          <a className="mt-3 inline-flex font-semibold underline" href="/login">
            Ir a login
          </a>
        ) : null}
      </div>
    );
  }

  if (data.user.role !== 'customer') {
    return <p className="text-sm text-[var(--muted)]">Redirigiendo al panel correspondiente...</p>;
  }

  const currentMonthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(now);
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInCurrentMonth }, (_, index) => index + 1);

  const purchaseDays = new Set(
    data.recentOrders
      .map((order) => new Date(order.createdAt))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getFullYear() === currentYear && date.getMonth() === currentMonth)
      .map((date) => date.getDate()),
  );

  const cutDateWithGrace = data.membership.activeUntil ? new Date(data.membership.activeUntil) : null;
  const cutDate = cutDateWithGrace && !Number.isNaN(cutDateWithGrace.getTime())
    ? new Date(cutDateWithGrace.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const hasValidCutDate = Boolean(cutDate && !Number.isNaN(cutDate.getTime()));
  const isCutDateThisMonth = Boolean(
    cutDate &&
      !Number.isNaN(cutDate.getTime()) &&
      cutDate.getFullYear() === currentYear &&
      cutDate.getMonth() === currentMonth,
  );
  const cutDayInMonth = isCutDateThisMonth && cutDate ? cutDate.getDate() : null;
  const purchaseDaysRemaining = Math.max(data.membership.daysRemaining - GRACE_DAYS, 0);
  const purchasedRatio = daysInCurrentMonth > 0 ? Math.min((purchaseDays.size / daysInCurrentMonth) * 100, 100) : 0;
  const selectedLevelSummary = selectedNetworkLevel
    ? networkSummary?.levels.find((item) => item.level === selectedNetworkLevel)
    : null;
  const selectedLevelPage = selectedNetworkLevel ? networkLevelsMembers[selectedNetworkLevel] : null;
  const selectedLevelLoading = selectedNetworkLevel ? Boolean(networkLevelsLoading[selectedNetworkLevel]) : false;
  const selectedLevelError = selectedNetworkLevel ? networkLevelsError[selectedNetworkLevel] : null;
  const selectedLevelMembers = selectedLevelPage?.members ?? [];
  const hasSelectedLevelMembers = selectedLevelMembers.length > 0;
  const normalizedOrdersSearch = ordersSearchTerm.trim().toLowerCase();
  const visibleOrders = ordersPageData
    ? ordersPageData.orders.filter((order) => {
        if (!normalizedOrdersSearch) {
          return true;
        }

        const searchableText = [
          order.id,
          formatOrderStatusLabel(order.status),
          formatDeliveryMethodLabel(order.deliveryMethod),
          formatPaymentMethodLabel(order.paymentMethod),
          order.address ?? '',
          order.phone ?? '',
          formatDateLabel(order.createdAt),
          formatCop(order.totalCop),
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedOrdersSearch);
      })
    : [];

  if (focus === 'home') {
    return (
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[radial-gradient(120%_120%_at_0%_0%,#1f5f96_0%,#1a4474_45%,#132e4f_100%)] p-5 text-white shadow-[0_20px_60px_rgba(16,42,67,0.22)]">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">Inicio</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">{formatCop(data.walletBalanceCop)}</h2>
            <p className="mt-1 text-sm text-white/80">Saldo disponible</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                Membresía: {data.membership.status}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                Referidos: {data.directReferralsCount}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                Órdenes: {data.recentOrders.length}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                Restan: {purchaseDaysRemaining} días
              </span>
            </div>
          </div>
        </section>

        <section className="app-card rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Ciclo de compras</p>
              <p className="mt-1 text-sm capitalize text-[var(--ink)]">{currentMonthLabel}</p>
            </div>
            <p className="rounded-full border border-[var(--line)] bg-[var(--surface-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
              {purchaseDays.size} días con compra
            </p>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-50)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#1f5f96,#29b394)]" style={{ width: `${purchasedRatio}%` }} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Fecha de corte</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                {hasValidCutDate && cutDate ? formatDateLabel(cutDate.toISOString()) : 'Sin fecha de corte'}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Dias con compra este mes</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{purchaseDays.size}</p>
            </div>
          </div>

          <div ref={calendarScrollRef} className="mt-3 overflow-x-auto pb-1 scroll-smooth">
            <div className="inline-flex min-w-max gap-1.5">
              {calendarDays.map((day) => {
                const purchased = purchaseDays.has(day);
                const isToday = now.getDate() === day;
                const isCutDay = cutDayInMonth === day;

                return (
                  <div
                    key={day}
                    ref={isToday ? currentDayRef : null}
                    className={`relative min-w-9 rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition ${
                      purchased
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]'
                        : 'border-[var(--line)] bg-white text-[var(--muted)]'
                    } ${isToday ? 'ring-2 ring-[var(--accent)] ring-offset-1' : ''}`}
                    title={purchased ? `Dia ${day}: compra registrada` : `Dia ${day}: sin compra`}
                  >
                    {isCutDay ? <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-rose-500" /> : null}
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Dia con compra
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Fecha de corte
            </span>
          </div>
        </section>

        <section className="app-card rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Accesos rápidos</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <a href={`/dashboard/${userId}/wallet`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-white">
              Wallet
            </a>
            <a href={`/dashboard/${userId}/network`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-white">
              Red
            </a>
            <a href={`/dashboard/${userId}/orders`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-white">
              Órdenes
            </a>
            <a href={`/dashboard/${userId}/profile`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-white">
              Perfil
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {show('overview') ? (
      <section id="overview" className="grid gap-3 scroll-mt-24 sm:grid-cols-2 md:grid-cols-3">
        <article className="app-card p-4">
          <p className="text-xs text-[var(--muted)]">Saldo en billetera</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--ink)]">{formatCop(data.walletBalanceCop)}</h2>
        </article>
        <article className="app-card p-4">
          <p className="text-xs text-[var(--muted)]">Referidos directos</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--ink)]">{data.directReferralsCount}</h2>
        </article>
        <article className="app-card p-4">
          <p className="text-xs text-[var(--muted)]">Membresía</p>
          <h2 className="mt-1 text-2xl font-semibold capitalize text-[var(--ink)]">{data.membership.status}</h2>
          <p className="text-xs text-[var(--muted)]">Días restantes: {data.membership.daysRemaining}</p>
        </article>
      </section>
      ) : null}

      {show('wallet') ? (
      <WalletPanel userId={userId} initialWalletBalanceCop={data.walletBalanceCop} />
      ) : null}

      {show('network') ? (
      <section id="network" className="app-card scroll-mt-24 overflow-hidden p-0">
        <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#1f5f96_0%,#1b3d6b_40%,#0f243d_100%)] px-5 py-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Red MLM</p>
          <h3 className="mt-2 text-2xl font-semibold">Usuarios por generación</h3>
          <p className="mt-1 text-sm text-white/80">Visualiza el crecimiento de tu red y quién está en cada generación.</p>

          {networkSummary ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Miembros totales</p>
                <p className="text-sm font-semibold text-white">{networkSummary.summary.totalMembers}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Directos</p>
                <p className="text-sm font-semibold text-white">{networkSummary.summary.directReferrals}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 bg-[linear-gradient(180deg,#f5f9ff_0%,#e9f1fa_100%)] p-4">
          {networkLoading ? (
            <div className="space-y-2 rounded-xl border border-[var(--line)] bg-white p-3" aria-busy="true" aria-live="polite">
              <SkeletonBar className="h-4 w-36" />
              <SkeletonBar className="h-14 w-full rounded-xl" />
              <SkeletonBar className="h-14 w-full rounded-xl" />
            </div>
          ) : null}

          {!networkLoading && networkError ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">{networkError}</p>
          ) : null}

          {!networkLoading && !networkError && networkSummary && levelNumbers.length === 0 ? (
            <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-3 text-sm text-[var(--muted)]">
              Aún no tienes usuarios en tu red.
            </p>
          ) : null}

          {!networkLoading && !networkError && networkSummary && levelNumbers.length > 0 ? (
            selectedNetworkLevel === null ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {networkSummary.levels.map((levelItem) => (
                  <button
                    key={levelItem.level}
                    type="button"
                    onClick={() => {
                      setSelectedNetworkLevel(levelItem.level);
                      if (!networkLevelsMembers[levelItem.level] && !networkLevelsLoading[levelItem.level]) {
                        loadNetworkLevelMembers(levelItem.level, 1);
                      }
                    }}
                    className="rounded-2xl border border-[#b8cde4] bg-[#deebf8] p-4 text-left shadow-[0_10px_26px_rgba(16,42,67,0.08)] transition hover:border-[#8eaed0] hover:bg-[#d4e6f7]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#38566a]">Generación {levelItem.level}</p>
                    <p className="mt-1 text-lg font-semibold text-[#0f2f4f]">{levelItem.count} usuario{levelItem.count === 1 ? '' : 's'}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#1f5f96]">Ver detalle</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#b8cde4] bg-[#deebf8] p-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#38566a]">Vista de generación</p>
                    <p className="text-sm font-semibold text-[#0f2f4f]">
                      Generación {selectedNetworkLevel} - {selectedLevelSummary?.count ?? 0} usuario{(selectedLevelSummary?.count ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNetworkLevel(null)}
                    className="rounded-full border border-[#9eb8d2] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f2f4f]"
                  >
                    Volver generaciones
                  </button>
                </div>

                {selectedLevelLoading && !hasSelectedLevelMembers ? (
                  <div className="space-y-2 rounded-xl border border-[var(--line)] bg-white p-3" aria-busy="true" aria-live="polite">
                    <SkeletonBar className="h-4 w-44" />
                    <SkeletonBar className="h-16 w-full rounded-xl" />
                    <SkeletonBar className="h-16 w-full rounded-xl" />
                  </div>
                ) : null}

                {!selectedLevelLoading && selectedLevelError ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">{selectedLevelError}</p>
                ) : null}

                {!selectedLevelLoading && !selectedLevelError && selectedLevelPage && selectedLevelMembers.length === 0 ? (
                  <p className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm text-[var(--muted)]">
                    No hay usuarios en esta generación.
                  </p>
                ) : null}

                {!selectedLevelError && selectedLevelMembers.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedLevelMembers.map((member) => (
                      <li key={member.id} className="rounded-xl border border-[#c4d6ea] bg-white p-3 shadow-[0_6px_14px_rgba(16,42,67,0.06)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--surface-50)] text-sm font-semibold text-[var(--ink)]">
                              {member.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[var(--ink)]">{member.fullName}</p>
                              <p className="text-xs text-[var(--muted)]">{member.email}</p>
                            </div>
                          </div>
                          <span className="rounded-full border border-[#c4d6ea] bg-[#f4f9ff] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#38566a]">
                            {member.referralCode}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#38566a]">
                          <span className="rounded-full bg-[#eef5fd] px-2 py-1">
                            Activo hasta: {member.membershipActiveUntil ? formatDateLabel(member.membershipActiveUntil) : 'Sin fecha'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {selectedLevelPage ? (
                  <div className="rounded-xl border border-[#c4d6ea] bg-white px-3 py-2">
                    <p className="text-xs text-[#38566a]">
                      Mostrando {selectedLevelPage.members.length} de {selectedLevelPage.total}
                    </p>
                    {selectedLevelPage.total > selectedLevelPage.members.length ? (
                      <>
                        <div ref={networkLevelSentinelRef} className="mt-2 h-3 w-full" aria-hidden="true" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#1f5f96]">
                          {selectedLevelLoading ? 'Cargando más usuarios...' : 'Desliza para cargar más'}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                        Generación cargada completa
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      </section>
      ) : null}

      {show('orders') ? (
      <section id="orders" className="app-card scroll-mt-24 overflow-hidden p-0">
        <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#1f5f96_0%,#1b3d6b_40%,#0f243d_100%)] px-5 py-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Órdenes</p>
          <h3 className="mt-2 text-2xl font-semibold">Seguimiento de pedidos</h3>
          <p className="mt-1 text-sm text-white/80">Controla estado, pagos y entrega de cada orden en tiempo real.</p>
          {ordersPageData ? (
            <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Total órdenes</p>
              <p className="text-sm font-semibold text-white">{ordersPageData.total}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 bg-[linear-gradient(180deg,#f5f9ff_0%,#e9f1fa_100%)] p-4">
          {ordersActionMessage ? (
            <p className="rounded-xl border border-[#c4d6ea] bg-white px-3 py-2 text-sm text-[var(--ink)]">{ordersActionMessage}</p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Buscar órdenes</span>
            <input
              type="text"
              value={ordersSearchTerm}
              onChange={(event) => setOrdersSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              placeholder="ID, estado, método de entrega o pago"
            />
          </label>

          {ordersLoading && !ordersPageData ? (
            <div className="space-y-2 rounded-xl border border-[var(--line)] bg-white p-3" aria-busy="true" aria-live="polite">
              <SkeletonBar className="h-4 w-36" />
              <SkeletonBar className="h-24 w-full rounded-xl" />
              <SkeletonBar className="h-24 w-full rounded-xl" />
            </div>
          ) : null}

          {!ordersLoading && ordersError ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">{ordersError}</p>
          ) : null}

          {!ordersLoading && !ordersError && ordersPageData && visibleOrders.length === 0 ? (
            <p className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm text-[var(--muted)]">
              {ordersPageData.orders.length === 0 ? 'Aún no tienes órdenes registradas.' : 'No hay resultados para tu búsqueda.'}
            </p>
          ) : null}

          {!ordersError && ordersPageData && visibleOrders.length > 0 ? (
            <ul className="space-y-2">
              {visibleOrders.map((order) => (
                <li key={order.id} className="rounded-xl border border-[#c4d6ea] bg-white p-3 shadow-[0_6px_14px_rgba(16,42,67,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Orden</p>
                      <p className="text-sm font-semibold text-[var(--ink)]">#{order.id.slice(0, 8)}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(order.status)}`}>
                      {formatOrderStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg bg-[var(--surface-50)] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Total</p>
                      <p className="text-sm font-semibold text-[var(--ink)]">{formatCop(order.totalCop)}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-50)] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Pagado wallet</p>
                      <p className="text-sm font-semibold text-[var(--ink)]">{formatCop(order.paidFromWalletCop)}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-50)] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Pendiente</p>
                      <p className="text-sm font-semibold text-[var(--ink)]">{formatCop(order.pendingPaymentCop)}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
                    <span className="rounded-full bg-[var(--surface-50)] px-2 py-1">{formatDeliveryMethodLabel(order.deliveryMethod)}</span>
                    <span className="rounded-full bg-[var(--surface-50)] px-2 py-1">{formatPaymentMethodLabel(order.paymentMethod)}</span>
                    <span className="rounded-full bg-[var(--surface-50)] px-2 py-1">{formatDateLabel(order.createdAt)}</span>
                  </div>

                  {order.deliveryMethod === 'home_delivery' && order.status === 'delivered' ? (
                    <div className="mt-3 rounded-xl border border-[#c4d6ea] bg-[#f8fbff] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#38566a]">Respaldo de entrega</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className={`rounded-full px-2 py-1 font-semibold ${order.courierDeliveryConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {order.courierDeliveryConfirmed ? 'Repartidor confirmó entrega' : 'Pendiente confirmación del repartidor'}
                        </span>
                        <span className={`rounded-full px-2 py-1 font-semibold ${order.customerReceivedConfirmedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {order.customerReceivedConfirmedAt
                            ? `Recibido por cliente: ${formatDateLabel(order.customerReceivedConfirmedAt)}`
                            : 'Pendiente tu confirmación'}
                        </span>
                      </div>

                      {!order.customerReceivedConfirmedAt ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setConfirmReceiptModalOrderId(order.id)}
                            disabled={confirmingReceiptOrderId === order.id}
                            className="rounded-xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {confirmingReceiptOrderId === order.id ? 'Confirmando...' : 'Confirmar recepción'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {ordersPageData ? (
            <div className="rounded-xl border border-[#c4d6ea] bg-white px-3 py-2">
              <p className="text-xs text-[#38566a]">
                Mostrando {visibleOrders.length} coincidencias de {ordersPageData.orders.length} cargadas ({ordersPageData.total} totales)
              </p>
              {ordersPageData.orders.length < ordersPageData.total ? (
                <>
                  <div ref={ordersSentinelRef} className="mt-2 h-3 w-full" aria-hidden="true" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#1f5f96]">
                    {ordersLoadingMore ? 'Cargando más órdenes...' : 'Desliza para cargar más'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700">Órdenes cargadas completas</p>
              )}
            </div>
          ) : null}

          {confirmReceiptModalOrderId ? (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" onClick={() => setConfirmReceiptModalOrderId(null)}>
              <div
                className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Confirmación</p>
                <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">¿Confirmas que recibiste este pedido?</h4>
                <p className="mt-2 text-sm text-[var(--muted)]">Esta acción marca la orden como recibida por el cliente.</p>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReceiptModalOrderId(null)}
                    className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmReceipt(confirmReceiptModalOrderId)}
                    disabled={confirmingReceiptOrderId === confirmReceiptModalOrderId}
                    className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmingReceiptOrderId === confirmReceiptModalOrderId ? 'Confirmando...' : 'Sí, confirmar'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {show('profile') ? (
      <section id="profile" className="app-card scroll-mt-24 overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/75">Perfil</p>
              <h3 className="mt-1 text-2xl font-semibold">{data.user.fullName}</h3>
              <p className="text-sm text-white/80">{data.user.email}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-lg font-semibold">
              {data.user.fullName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-[var(--surface-50)] p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Rol</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatRoleLabel(data.user.role)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-50)] p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Nombre de usuario</p>
            {data.user.username ? (
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">@{data.user.username}</p>
            ) : (
              <p className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                Sin definir
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-[var(--surface-50)] p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Wallet</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(data.walletBalanceCop)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-50)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Codigo referido</p>
              <button
                type="button"
                onClick={() => copyReferralCode(data.user.referralCode)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]"
                title="Copiar codigo"
                aria-label="Copiar codigo referido"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copiar
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{data.user.referralCode}</p>
            {copiedReferral ? <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Copiado</p> : null}
          </div>
        </div>
        <div className="border-t border-[var(--line)] px-4 pb-4 pt-3">
          <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white p-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Editar perfil</p>
            <ProfileSettingsForm userId={userId} user={data.user} />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700"
          >
            Cerrar sesión
          </button>
        </div>
      </section>
      ) : null}
    </div>
  );
}
