'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createOrder, getInventoryProductsPage, getPaymentSettings } from '@/services/api';
import { compressPaymentProofImage } from '@/services/image-compression';
import { getAuthSession, StoredAuthSession } from '@/services/auth-session';
import { DeliveryFeesByMunicipality, DeliveryMethod, InventoryProduct, PaymentAccountConfig, PaymentMethod } from '@/types/domain';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

const CART_STORAGE_KEY = 'grv_store_cart';
const STORE_PRODUCTS_PAGE_SIZE = 24;
const STORE_FAVORITES_KEY_PREFIX = 'grv_store_favorites';
const STORE_RATINGS_KEY_PREFIX = 'grv_store_ratings';

type CartMap = Record<string, number>;
type ProductFavoritesMap = Record<string, boolean>;
type ProductRatingsMap = Record<string, number>;
type StoreSection = 'all' | 'bebidas' | 'despensa' | 'lacteos' | 'cuidado' | 'destacados';
type DeliveryZone = 'Dosquebradas' | 'Pereira' | 'Cuba';
type AddressRoadType = 'Calle' | 'Carrera' | 'Diagonal' | 'Transversal' | 'Manzana' | 'Vereda';

interface StorePageProps {
  dashboardMode?: boolean;
  dashboardUserId?: string;
}

interface DeliveryAddressForm {
  zone: DeliveryZone;
  neighborhood: string;
  roadType: AddressRoadType;
  mainNumber: string;
  secondaryNumber: string;
  propertyNumber: string;
  complement: string;
  reference: string;
}

const DELIVERY_ZONE_OPTIONS: DeliveryZone[] = ['Dosquebradas', 'Pereira', 'Cuba'];
const ADDRESS_ROAD_TYPE_OPTIONS: AddressRoadType[] = ['Calle', 'Carrera', 'Diagonal', 'Transversal', 'Manzana', 'Vereda'];
const DEFAULT_DELIVERY_FEES_BY_MUNICIPALITY: DeliveryFeesByMunicipality = {
  Dosquebradas: 12000,
  Pereira: 12000,
  Cuba: 12000,
};

function getDeliveryZoneLabel(zone: DeliveryZone): string {
  switch (zone) {
    case 'Cuba':
      return 'Cuba (Pereira)';
    case 'Dosquebradas':
      return 'Dosquebradas';
    case 'Pereira':
    default:
      return 'Pereira';
  }
}

function buildDeliveryAddress(address: DeliveryAddressForm): string {
  const mainNumber = address.mainNumber.trim();
  const secondaryNumber = address.secondaryNumber.trim();
  const propertyNumber = address.propertyNumber.trim();
  const neighborhood = address.neighborhood.trim();
  const complement = address.complement.trim();
  const reference = address.reference.trim();

  const streetParts: string[] = [address.roadType];
  if (mainNumber) {
    streetParts.push(mainNumber);
  }

  const hashSection = [secondaryNumber, propertyNumber].filter(Boolean).join('-');
  if (hashSection) {
    streetParts.push(`# ${hashSection}`);
  }

  const baseAddress = streetParts.join(' ').trim();
  const segments = [baseAddress, neighborhood ? `Barrio/Sector ${neighborhood}` : '', getDeliveryZoneLabel(address.zone)].filter(Boolean);

  if (complement) {
    segments.push(`Complemento: ${complement}`);
  }

  if (reference) {
    segments.push(`Referencia: ${reference}`);
  }

  return segments.join(', ');
}

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPaymentMethodLabel(paymentMethod: PaymentMethod): string {
  switch (paymentMethod) {
    case 'wallet':
      return 'Wallet';
    case 'bank_transfer':
      return 'Transferencia bancaria';
    case 'mobile_payment':
      return 'Pago movil';
    case 'cash':
    case 'cash_on_delivery':
      return 'Efectivo';
    default:
      return 'Metodo de pago';
  }
}

function normalizePaymentMethod(method: PaymentMethod): PaymentMethod {
  return method === 'cash_on_delivery' ? 'cash' : method;
}

function requiresPaymentProof(method: PaymentMethod): boolean {
  const normalized = normalizePaymentMethod(method);
  return normalized === 'bank_transfer' || normalized === 'mobile_payment';
}

function requiresPaymentAccount(method: PaymentMethod): boolean {
  const normalized = normalizePaymentMethod(method);
  return normalized === 'bank_transfer' || normalized === 'mobile_payment';
}

async function preparePaymentProof(file: File): Promise<string> {
  return compressPaymentProofImage(file);
}

function getProductCategory(productName: string): StoreSection {
  const normalized = productName.toLowerCase();

  if (/(cafe|té|te|jugo|agua|bebida|refresco)/.test(normalized)) {
    return 'bebidas';
  }

  if (/(leche|queso|yogur|mantequilla)/.test(normalized)) {
    return 'lacteos';
  }

  if (/(arroz|harina|miel|aceite|grano|despensa|azucar|azúcar)/.test(normalized)) {
    return 'despensa';
  }

  if (/(jabon|jabón|crema|shampoo|cuidado|salud|piel)/.test(normalized)) {
    return 'cuidado';
  }

  return 'destacados';
}

function getProductTone(category: StoreSection): string {
  switch (category) {
    case 'bebidas':
      return 'from-sky-500 via-cyan-400 to-emerald-400';
    case 'lacteos':
      return 'from-zinc-300 via-stone-200 to-white';
    case 'despensa':
      return 'from-amber-300 via-lime-300 to-emerald-300';
    case 'cuidado':
      return 'from-rose-300 via-fuchsia-300 to-violet-300';
    default:
      return 'from-slate-600 via-slate-400 to-slate-200';
  }
}

function getCategoryLabel(category: StoreSection): string {
  switch (category) {
    case 'bebidas':
      return 'Bebidas';
    case 'lacteos':
      return 'Lácteos';
    case 'despensa':
      return 'Despensa';
    case 'cuidado':
      return 'Cuidado';
    case 'destacados':
      return 'Destacado';
    case 'all':
    default:
      return 'Todo';
  }
}

function getCategoryOptions(products: InventoryProduct[]): StoreSection[] {
  const categories = new Set<StoreSection>(['all']);
  for (const product of products) categories.add(getProductCategory(product.name));

  const ordered: StoreSection[] = ['all', 'destacados', 'bebidas', 'lacteos', 'despensa', 'cuidado'];
  return ordered.filter((category) => categories.has(category));
}

function toCartArray(products: InventoryProduct[], cart: CartMap) {
  const productById = new Map(products.map((product) => [product.id, product] as const));

  return Object.entries(cart)
    .map(([productId, quantity]) => {
      const product = productById.get(productId);
      if (!product || quantity <= 0) return null;
      return { product, quantity };
    })
    .filter((item): item is { product: InventoryProduct; quantity: number } => Boolean(item));
}

function ProductCard({
  product,
  quantity,
  isFavorite,
  rating,
  onAdd,
  onRemove,
  onToggleFavorite,
  onRate,
}: {
  product: InventoryProduct;
  quantity: number;
  isFavorite: boolean;
  rating: number;
  onAdd: () => void;
  onRemove: () => void;
  onToggleFavorite: () => void;
  onRate: (value: number) => void;
}) {
  const category = getProductCategory(product.name);
  const tone = getProductTone(category);

  return (
    <article className="app-card overflow-hidden">
      <div className={`relative h-40 bg-gradient-to-br ${tone} p-4`}>
        <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
          {getCategoryLabel(category)}
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-base text-[var(--ink)] shadow-sm"
        >
          {isFavorite ? '❤' : '♡'}
        </button>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.44))]" />
        <div className="absolute bottom-4 left-4 right-4 h-20 rounded-[1.35rem] border border-white/45 bg-white/55 backdrop-blur-sm" />
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Producto</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--ink)]">{product.name}</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-[var(--muted)]">Precio</p>
            <p className="text-xl font-semibold text-[var(--ink)]">{formatCop(product.priceCop)}</p>
          </div>
          <div className="rounded-full bg-[var(--surface-50)] px-3 py-1.5 text-xs font-medium text-[var(--ink)]">Stock: {product.stock}</div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-2">
          <button
            type="button"
            onClick={onRemove}
            disabled={quantity === 0}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-semibold text-[var(--ink)] shadow-sm disabled:opacity-45"
          >
            −
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Cantidad</p>
            <p className="text-lg font-semibold text-[var(--ink)]">{quantity}</p>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] text-lg font-semibold text-white shadow-md shadow-sky-900/15"
          >
            +
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Calificacion</p>
          <div className="mt-1 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              const selected = value <= rating;
              return (
                <button
                  key={`${product.id}-rating-${value}`}
                  type="button"
                  onClick={() => onRate(value)}
                  className={`text-lg leading-none transition ${selected ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                  aria-label={`Calificar con ${value} estrellas`}
                >
                  ★
                </button>
              );
            })}
            <span className="ml-2 text-xs text-[var(--muted)]">{rating > 0 ? `${rating}/5` : 'Sin calificar'}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CartRow({
  product,
  quantity,
  onAdd,
  onRemove,
}: {
  product: InventoryProduct;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">{product.name}</p>
        <p className="text-xs text-[var(--muted)]">{formatCop(product.priceCop)} x {quantity}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-50)] text-[var(--ink)] shadow-sm">−</button>
        <span className="min-w-8 text-center text-sm font-semibold text-[var(--ink)]">{quantity}</span>
        <button type="button" onClick={onAdd} className="grid h-8 w-8 place-items-center rounded-full bg-black text-white shadow-sm">+</button>
      </div>
    </div>
  );
}

export function StorePage({ dashboardMode = false, dashboardUserId }: StorePageProps) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotal, setProductsTotal] = useState(0);
  const [activeCategory, setActiveCategory] = useState<StoreSection>('all');
  const [cart, setCart] = useState<CartMap>({});
  const [favorites, setFavorites] = useState<ProductFavoritesMap>({});
  const [ratings, setRatings] = useState<ProductRatingsMap>({});
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>([
    'wallet',
    'bank_transfer',
    'mobile_payment',
    'cash',
  ]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountConfig[]>([]);
  const [deliveryFeesByMunicipality, setDeliveryFeesByMunicipality] = useState<DeliveryFeesByMunicipality>(
    DEFAULT_DELIVERY_FEES_BY_MUNICIPALITY,
  );
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressForm>({
    zone: 'Dosquebradas',
    neighborhood: '',
    roadType: 'Calle',
    mainNumber: '',
    secondaryNumber: '',
    propertyNumber: '',
    complement: '',
    reference: '',
  });
  const [phone, setPhone] = useState('');
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string | null>(null);
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const productsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const shopperId = session?.user.id ?? 'guest';

  const hasMoreProducts = products.length < productsTotal;

  const fetchProducts = async (page: number, append = false, query = searchQuery) => {
    const response = await getInventoryProductsPage(page, STORE_PRODUCTS_PAGE_SIZE, query);
    setProductsPage(response.page);
    setProductsTotal(response.total);
    setProducts((current) => {
      if (!append) {
        return response.products;
      }

      const seen = new Set(current.map((item) => item.id));
      const next = [...current];
      for (const product of response.products) {
        if (seen.has(product.id)) {
          continue;
        }
        seen.add(product.id);
        next.push(product);
      }

      return next;
    });
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError(null);
    setProducts([]);
    setProductsPage(1);
    setProductsTotal(0);

    fetchProducts(1, false, searchQuery)
      .then(() => {
        if (!mounted) {
          return;
        }
      })
      .catch((fetchError: Error) => {
        if (!mounted) {
          return;
        }
        setError(fetchError.message);
      })
      .finally(() => {
        if (!mounted) {
          return;
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [searchQuery]);

  useEffect(() => {
    if (loading || loadingMoreProducts || !hasMoreProducts) {
      return;
    }

    const sentinel = productsLoadMoreRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        if (loading || loadingMoreProducts || !hasMoreProducts) {
          return;
        }

        setLoadingMoreProducts(true);
        fetchProducts(productsPage + 1, true)
          .catch((fetchError: Error) => {
            setError(fetchError.message);
          })
          .finally(() => {
            setLoadingMoreProducts(false);
          });
      },
      {
        root: null,
        rootMargin: '260px 0px',
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMoreProducts, hasMoreProducts, productsPage]);

  useEffect(() => {
    setHydrated(true);
    const currentSession = getAuthSession();
    setSession(currentSession);

    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (rawCart) {
      try {
        setCart(JSON.parse(rawCart) as CartMap);
      } catch {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      }
    }

    const persistedFavorites = window.localStorage.getItem(
      getStoreScopedKey(STORE_FAVORITES_KEY_PREFIX, currentSession?.user.id ?? 'guest'),
    );
    if (persistedFavorites) {
      try {
        setFavorites(JSON.parse(persistedFavorites) as ProductFavoritesMap);
      } catch {
        setFavorites({});
      }
    }

    const persistedRatings = window.localStorage.getItem(
      getStoreScopedKey(STORE_RATINGS_KEY_PREFIX, currentSession?.user.id ?? 'guest'),
    );
    if (persistedRatings) {
      try {
        setRatings(JSON.parse(persistedRatings) as ProductRatingsMap);
      } catch {
        setRatings({});
      }
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const persistedFavorites = window.localStorage.getItem(getStoreScopedKey(STORE_FAVORITES_KEY_PREFIX, shopperId));
    if (persistedFavorites) {
      try {
        setFavorites(JSON.parse(persistedFavorites) as ProductFavoritesMap);
      } catch {
        setFavorites({});
      }
    } else {
      setFavorites({});
    }

    const persistedRatings = window.localStorage.getItem(getStoreScopedKey(STORE_RATINGS_KEY_PREFIX, shopperId));
    if (persistedRatings) {
      try {
        setRatings(JSON.parse(persistedRatings) as ProductRatingsMap);
      } catch {
        setRatings({});
      }
    } else {
      setRatings({});
    }
  }, [hydrated, shopperId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(getStoreScopedKey(STORE_FAVORITES_KEY_PREFIX, shopperId), JSON.stringify(favorites));
  }, [favorites, hydrated, shopperId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(getStoreScopedKey(STORE_RATINGS_KEY_PREFIX, shopperId), JSON.stringify(ratings));
  }, [ratings, hydrated, shopperId]);

  useEffect(() => {
    if (!cartOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCartOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [cartOpen]);

  const categories = useMemo(() => getCategoryOptions(products), [products]);
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const category = getProductCategory(product.name);
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesFavorites = !showOnlyFavorites || Boolean(favorites[product.id]);
      return matchesCategory && matchesFavorites;
    });
  }, [activeCategory, favorites, products, showOnlyFavorites]);

  const cartItems = useMemo(() => toCartArray(products, cart), [cart, products]);
  const subtotalCop = useMemo(() => cartItems.reduce((sum, item) => sum + item.product.priceCop * item.quantity, 0), [cartItems]);
  const itemCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);
  const deliveryFeeCop = deliveryMethod === 'home_delivery' ? Math.max(0, Number(deliveryFeesByMunicipality[deliveryAddress.zone] ?? 0)) : 0;
  const totalCop = subtotalCop + deliveryFeeCop;
  const hasToken = Boolean(session?.accessToken);
  const bottomNavUserId = dashboardMode ? dashboardUserId : undefined;
  const formattedDeliveryAddress = useMemo(() => buildDeliveryAddress(deliveryAddress), [deliveryAddress]);
  const availablePaymentMethods = useMemo(
    () => Array.from(new Set(enabledPaymentMethods.map((method) => normalizePaymentMethod(method)))),
    [enabledPaymentMethods],
  );
  const selectedPaymentAccounts = useMemo(
    () => paymentAccounts.filter((account) => account.method === paymentMethod),
    [paymentAccounts, paymentMethod],
  );

  useEffect(() => {
    let mounted = true;
    getPaymentSettings()
      .then((settings) => {
        if (!mounted) {
          return;
        }

        setEnabledPaymentMethods(settings.enabledPaymentMethods.map((method) => normalizePaymentMethod(method)));
        setPaymentAccounts(settings.paymentAccounts.map((account) => ({ ...account, method: normalizePaymentMethod(account.method) })));
        setDeliveryFeesByMunicipality(settings.deliveryFeesByMunicipality ?? DEFAULT_DELIVERY_FEES_BY_MUNICIPALITY);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setEnabledPaymentMethods(['wallet', 'bank_transfer', 'mobile_payment', 'cash']);
        setPaymentAccounts([]);
        setDeliveryFeesByMunicipality(DEFAULT_DELIVERY_FEES_BY_MUNICIPALITY);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0] ?? 'wallet');
    }
  }, [availablePaymentMethods, paymentMethod]);

  useEffect(() => {
    if (!requiresPaymentProof(paymentMethod)) {
      setPaymentProofDataUrl(null);
      setPaymentProofName(null);
      setUploadingPaymentProof(false);
    }
  }, [paymentMethod]);

  function updateCart(productId: string, delta: number) {
    setCheckoutMessage(null);
    setCart((current) => {
      const nextQuantity = Math.max(0, (current[productId] ?? 0) + delta);
      const next = { ...current };
      if (nextQuantity === 0) delete next[productId];
      else next[productId] = nextQuantity;
      return next;
    });
  }

  function toggleFavorite(productId: string) {
    setFavorites((current) => {
      if (current[productId]) {
        const next = { ...current };
        delete next[productId];
        return next;
      }

      return {
        ...current,
        [productId]: true,
      };
    });
  }

  function rateProduct(productId: string, value: number) {
    setRatings((current) => ({
      ...current,
      [productId]: value,
    }));
  }

  async function handleCheckout() {
    setCheckoutMessage(null);

    if (!hasToken) {
      setCheckoutMessage('Inicia sesión para finalizar la compra.');
      return;
    }

    if (cartItems.length === 0) {
      setCheckoutMessage('Agrega productos al carrito antes de continuar.');
      return;
    }

    if (deliveryMethod === 'home_delivery') {
      const hasCompleteAddress = Boolean(
        deliveryAddress.zone &&
          deliveryAddress.neighborhood.trim() &&
          deliveryAddress.mainNumber.trim() &&
          deliveryAddress.secondaryNumber.trim() &&
          deliveryAddress.propertyNumber.trim() &&
          phone.trim(),
      );

      if (!hasCompleteAddress) {
        setCheckoutMessage('Completa zona, barrio, dirección y teléfono para el domicilio.');
        return;
      }
    }

    if (requiresPaymentProof(paymentMethod) && !paymentProofDataUrl) {
      setCheckoutMessage('Debes adjuntar el comprobante de pago para continuar.');
      return;
    }

    if (requiresPaymentAccount(paymentMethod) && selectedPaymentAccounts.length === 0) {
      setCheckoutMessage('No hay cuentas configuradas para este metodo de pago. Contacta al administrador.');
      return;
    }

    setCheckingOut(true);
    try {
      const result = await createOrder({
        paymentMethod,
        deliveryMethod,
        deliveryFeeCop: deliveryMethod === 'home_delivery' ? deliveryFeeCop : 0,
        address: deliveryMethod === 'home_delivery' ? formattedDeliveryAddress : undefined,
        phone: deliveryMethod === 'home_delivery' ? phone.trim() : undefined,
        useWallet: paymentMethod === 'wallet',
        paymentProofDataUrl: requiresPaymentProof(paymentMethod) ? paymentProofDataUrl ?? undefined : undefined,
        items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      });

      setCart({});
      setCartOpen(false);
      setPaymentProofDataUrl(null);
      setPaymentProofName(null);
      setCheckoutMessage(
        `Pedido creado correctamente${typeof result === 'object' && result && 'id' in result ? ` (${String((result as { id?: string }).id).slice(0, 8)})` : ''}.`,
      );
    } catch (checkoutError) {
      setCheckoutMessage(checkoutError instanceof Error ? checkoutError.message : 'No se pudo crear el pedido');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-36 pt-4 md:px-6 md:pt-6">
      <section className="app-card overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-6 text-white sm:px-6 sm:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">Tienda oficial</p>
          <div className="mt-2">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">Granja Raiz de Vida</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">Productos frescos, compra agil y catalogo.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
          <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3.5 shadow-sm">
            <span className="text-[var(--muted)]">⌕</span>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar productos, marcas o sabores" />
          </div>
          <div className="hidden sm:block text-right text-xs text-[var(--muted)]">
            Mostrando {filteredProducts.length} de {productsTotal}
          </div>
        </div>

        <div className="px-4 pb-5 sm:px-5" />

        <div className="flex gap-2 overflow-x-auto px-4 pb-5 sm:px-5">
          {categories.map((category) => {
            const label = getCategoryLabel(category);
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  isActive ? 'bg-black text-white shadow-sm' : 'border border-[var(--line)] bg-white text-[var(--ink)]'
                }`}
              >
                {label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowOnlyFavorites((current) => !current)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
              showOnlyFavorites ? 'bg-rose-600 text-white shadow-sm' : 'border border-[var(--line)] bg-white text-[var(--ink)]'
            }`}
          >
            {showOnlyFavorites ? 'Favoritos: on' : 'Solo favoritos'}
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_0.9fr] lg:items-start">
        <div className="space-y-5">
          <div id="catalog" className="grid gap-4 scroll-mt-24 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <article key={`store-product-skeleton-${index}`} className="app-card overflow-hidden" aria-hidden="true">
                  <div className="h-40 bg-[linear-gradient(135deg,#d9e7f5,#edf4fb)] p-4">
                    <div className="skeleton-shimmer h-6 w-20 rounded-full bg-white/70" />
                    <div className="skeleton-shimmer mt-16 h-20 rounded-[1.35rem] border border-white/50 bg-white/60" />
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <div className="skeleton-shimmer h-3 w-14 rounded bg-[var(--line)]" />
                      <div className="skeleton-shimmer mt-2 h-5 w-3/4 rounded bg-[var(--line)]" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="skeleton-shimmer h-6 w-28 rounded bg-[var(--line)]" />
                      <div className="skeleton-shimmer h-6 w-16 rounded-full bg-[var(--line)]" />
                    </div>
                    <div className="skeleton-shimmer h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)]" />
                  </div>
                </article>
              ))
            ) : error ? (
              <div className="app-card border-red-200 bg-red-50 p-4 text-sm text-red-700">Error cargando productos: {error}</div>
            ) : filteredProducts.length === 0 ? (
              <div className="app-card p-4 text-sm text-[var(--muted)]">No hay productos que coincidan con tu búsqueda.</div>
            ) : (
              <>
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart[product.id] ?? 0}
                    isFavorite={Boolean(favorites[product.id])}
                    rating={ratings[product.id] ?? 0}
                    onAdd={() => updateCart(product.id, 1)}
                    onRemove={() => updateCart(product.id, -1)}
                    onToggleFavorite={() => toggleFavorite(product.id)}
                    onRate={(value) => rateProduct(product.id, value)}
                  />
                ))}
                {hasMoreProducts ? (
                  <div className="sm:col-span-2 xl:col-span-3">
                    <div ref={productsLoadMoreRef} className="h-3 w-full" aria-hidden="true" />
                    <div className="app-card bg-[var(--surface-50)] p-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      {loadingMoreProducts ? 'Cargando mas productos...' : 'Desliza para cargar mas'}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

        </div>

        <aside id="cart" className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <CartSidebar
            itemCount={itemCount}
            cartItems={cartItems}
            subtotalCop={subtotalCop}
            deliveryFeeCop={deliveryFeeCop}
            totalCop={totalCop}
            deliveryMethod={deliveryMethod}
            setDeliveryMethod={setDeliveryMethod}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            availablePaymentMethods={availablePaymentMethods}
            paymentAccountsForMethod={selectedPaymentAccounts}
            paymentProofName={paymentProofName}
            uploadingPaymentProof={uploadingPaymentProof}
            onProofFileChange={async (file) => {
              if (!file) {
                setPaymentProofDataUrl(null);
                setPaymentProofName(null);
                return;
              }

              setCheckoutMessage(null);
              setUploadingPaymentProof(true);
              try {
                const dataUrl = await preparePaymentProof(file);
                setPaymentProofDataUrl(dataUrl);
                setPaymentProofName(file.name);
              } catch (uploadError) {
                setCheckoutMessage(uploadError instanceof Error ? uploadError.message : 'No se pudo adjuntar el comprobante.');
              } finally {
                setUploadingPaymentProof(false);
              }
            }}
            deliveryAddress={deliveryAddress}
            formattedDeliveryAddress={formattedDeliveryAddress}
            setDeliveryAddress={setDeliveryAddress}
            phone={phone}
            setPhone={setPhone}
            checkoutMessage={checkoutMessage}
            onCheckout={handleCheckout}
            checkingOut={checkingOut}
            hasToken={hasToken}
            onClose={() => setCartOpen(false)}
            onAdd={updateCart}
            onRemove={updateCart}
          />
        </aside>
      </section>

      {cartOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" aria-label="Cerrar carrito" className="absolute inset-0 bg-black/45" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 h-full max-h-[100dvh] w-full max-w-md overflow-y-auto overscroll-contain touch-pan-y rounded-l-[2.25rem] border-l border-y border-[var(--line)] bg-[rgba(248,250,252,0.98)] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CartSidebar
              itemCount={itemCount}
              cartItems={cartItems}
              subtotalCop={subtotalCop}
              deliveryFeeCop={deliveryFeeCop}
              totalCop={totalCop}
              deliveryMethod={deliveryMethod}
              setDeliveryMethod={setDeliveryMethod}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              availablePaymentMethods={availablePaymentMethods}
              paymentAccountsForMethod={selectedPaymentAccounts}
              paymentProofName={paymentProofName}
              uploadingPaymentProof={uploadingPaymentProof}
              onProofFileChange={async (file) => {
                if (!file) {
                  setPaymentProofDataUrl(null);
                  setPaymentProofName(null);
                  return;
                }

                setCheckoutMessage(null);
                setUploadingPaymentProof(true);
                try {
                  const dataUrl = await preparePaymentProof(file);
                  setPaymentProofDataUrl(dataUrl);
                  setPaymentProofName(file.name);
                } catch (uploadError) {
                  setCheckoutMessage(uploadError instanceof Error ? uploadError.message : 'No se pudo adjuntar el comprobante.');
                } finally {
                  setUploadingPaymentProof(false);
                }
              }}
              deliveryAddress={deliveryAddress}
              formattedDeliveryAddress={formattedDeliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              phone={phone}
              setPhone={setPhone}
              checkoutMessage={checkoutMessage}
              onCheckout={handleCheckout}
              checkingOut={checkingOut}
              hasToken={hasToken}
              onClose={() => setCartOpen(false)}
              onAdd={updateCart}
              onRemove={updateCart}
              compact
            />
          </div>
        </div>
      ) : null}

      {!cartOpen ? (
        <div
          className={`fixed right-4 z-[72] lg:hidden ${
            dashboardMode ? 'bottom-28 md:bottom-8' : 'bottom-6 md:bottom-8'
          } md:bottom-auto md:top-1/2 md:-translate-y-1/2`}
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Abrir carrito"
            className="group relative grid h-14 w-14 place-items-center rounded-[1.2rem] border border-white/55 bg-[linear-gradient(145deg,rgba(255,255,255,0.82),rgba(255,255,255,0.62))] text-[var(--ink)] shadow-[0_18px_45px_rgba(16,42,54,0.28)] backdrop-blur-xl transition hover:-translate-y-0.5"
          >
            <span className="absolute -inset-[1px] rounded-[1.2rem] bg-[linear-gradient(135deg,rgba(31,95,150,0.35),rgba(41,179,148,0.26))] opacity-55 blur-[1px]" />
            <span className="relative grid h-10 w-10 place-items-center rounded-[0.95rem] bg-[linear-gradient(135deg,#1f5f96,#29b394)] text-white shadow-md shadow-sky-900/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9h14l-1 12H6L5 9Z" />
                <path d="M9 9V7a3 3 0 0 1 6 0v2" />
              </svg>
            </span>
            <span className="absolute -right-1.5 -top-1.5 grid min-h-6 min-w-6 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {itemCount}
            </span>
          </button>
        </div>
      ) : null}

      {dashboardMode ? <AppBottomNav userId={bottomNavUserId} role="customer" /> : null}
    </main>
  );
}

function CartSidebar({
  itemCount,
  cartItems,
  subtotalCop,
  deliveryFeeCop,
  totalCop,
  deliveryMethod,
  setDeliveryMethod,
  paymentMethod,
  setPaymentMethod,
  availablePaymentMethods,
  paymentAccountsForMethod,
  paymentProofName,
  uploadingPaymentProof,
  onProofFileChange,
  deliveryAddress,
  formattedDeliveryAddress,
  setDeliveryAddress,
  phone,
  setPhone,
  checkoutMessage,
  onCheckout,
  checkingOut,
  hasToken,
  onClose,
  onAdd,
  onRemove,
  compact = false,
}: {
  itemCount: number;
  cartItems: Array<{ product: InventoryProduct; quantity: number }>;
  subtotalCop: number;
  deliveryFeeCop: number;
  totalCop: number;
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (value: DeliveryMethod) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (value: PaymentMethod) => void;
  availablePaymentMethods: PaymentMethod[];
  paymentAccountsForMethod: PaymentAccountConfig[];
  paymentProofName: string | null;
  uploadingPaymentProof: boolean;
  onProofFileChange: (file: File | null) => Promise<void>;
  deliveryAddress: DeliveryAddressForm;
  formattedDeliveryAddress: string;
  setDeliveryAddress: (value: DeliveryAddressForm | ((current: DeliveryAddressForm) => DeliveryAddressForm)) => void;
  phone: string;
  setPhone: (value: string) => void;
  checkoutMessage: string | null;
  onCheckout: () => void;
  checkingOut: boolean;
  hasToken: boolean;
  onClose: () => void;
  onAdd: (productId: string, delta: number) => void;
  onRemove: (productId: string, delta: number) => void;
  compact?: boolean;
}) {
  const sectionOverflowClass = compact ? 'overflow-visible' : 'overflow-hidden';
  const bodyOverflowClass = compact ? 'overflow-visible' : 'overflow-hidden';
  const itemsOverflowClass = compact ? 'overflow-visible' : 'overflow-y-auto';
  const sectionHeightClass = compact ? 'h-auto min-h-[100dvh]' : 'h-full';

  return (
    <section className={`flex ${sectionHeightClass} min-h-0 flex-col ${compact ? 'rounded-l-[2.25rem]' : 'app-card rounded-[2rem]'} ${sectionOverflowClass} ${compact ? 'border-0' : 'border border-[var(--line)]'}`}>
      <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(31,95,150,0.07),rgba(41,179,148,0.08))] px-4 py-4 sm:px-5">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[var(--line)]" />
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Carrito</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ink)]">Resumen de compra</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-sm">{itemCount} items</span>
            <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] lg:hidden">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5 ${bodyOverflowClass}`}>
        <div className={`min-h-0 flex-1 space-y-2 pr-1 ${itemsOverflowClass}`}>
          {itemCount === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)] shadow-sm">
              Agrega productos para empezar tu compra.
            </div>
          ) : (
            cartItems.map(({ product, quantity }) => (
              <CartRow
                key={product.id}
                product={product}
                quantity={quantity}
                onAdd={() => onAdd(product.id, 1)}
                onRemove={() => onRemove(product.id, -1)}
              />
            ))
          )}
        </div>

        <div className="mt-4 grid gap-3 rounded-[1.65rem] bg-white p-4 shadow-sm ring-1 ring-[var(--line)] sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Subtotal</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(subtotalCop)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Envío</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(deliveryFeeCop)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-50)] p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Total</p>
            <p className="mt-1 text-lg font-semibold text-[var(--accent)]">{formatCop(totalCop)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-4 rounded-[1.65rem] border border-[var(--line)] bg-white p-4 shadow-sm">
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Entrega</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMethod('pickup')}
                className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${deliveryMethod === 'pickup' ? 'bg-black text-white' : 'border border-[var(--line)] bg-white text-[var(--ink)]'}`}
              >
                Recoger
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod('home_delivery')}
                className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${deliveryMethod === 'home_delivery' ? 'bg-black text-white' : 'border border-[var(--line)] bg-white text-[var(--ink)]'}`}
              >
                Domicilio
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Pago</label>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="app-input">
              {availablePaymentMethods.map((method) => (
                <option key={method} value={method}>
                  {formatPaymentMethodLabel(method)}
                </option>
              ))}
            </select>
          </div>

          {requiresPaymentAccount(paymentMethod) || requiresPaymentProof(paymentMethod) ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
              {requiresPaymentAccount(paymentMethod) ? (
                paymentAccountsForMethod.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Cuentas para pagar</p>
                    {paymentAccountsForMethod.map((account) => (
                      <div key={account.id} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-[var(--ink)]">{account.label}</p>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">Titular: {account.holderName}</p>
                        <p className="text-[11px] text-[var(--muted)]">Referencia: {account.accountRef}</p>
                        {account.details ? <p className="mt-1 text-[11px] text-[var(--muted)]">{account.details}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Aun no hay cuentas configuradas para este metodo. Contacta al administrador.
                  </p>
                )
              ) : null}

              {requiresPaymentProof(paymentMethod) ? (
                <div className="mb-3 space-y-2">
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Comprobante de pago</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void onProofFileChange(file);
                    }}
                    className="app-input"
                  />
                  <p className="mt-2 text-[11px] text-[var(--muted)]">Sube una foto legible de la transferencia o pago movil. Maximo 3 MB; se comprime automaticamente.</p>
                  {uploadingPaymentProof ? <p className="mt-1 text-xs font-medium text-[var(--ink)]">Cargando comprobante...</p> : null}
                  {paymentProofName ? <p className="mt-1 text-xs font-medium text-emerald-700">Archivo: {paymentProofName}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {deliveryMethod === 'home_delivery' ? (
            <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
              <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                Cobertura en Dosquebradas, Pereira y Cuba. Escribe la dirección con nomenclatura colombiana.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Zona de entrega</span>
                  <select
                    value={deliveryAddress.zone}
                    onChange={(event) =>
                      setDeliveryAddress((current) => ({
                        ...current,
                        zone: event.target.value as DeliveryZone,
                      }))
                    }
                    className="app-input"
                  >
                    {DELIVERY_ZONE_OPTIONS.map((zone) => (
                      <option key={zone} value={zone}>
                        {getDeliveryZoneLabel(zone)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Barrio o sector</span>
                  <input
                    value={deliveryAddress.neighborhood}
                    onChange={(event) =>
                      setDeliveryAddress((current) => ({
                        ...current,
                        neighborhood: event.target.value,
                      }))
                    }
                    className="app-input"
                    placeholder="Ej: Frailes, Cuba, Roma, Villa Verde"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Dirección principal</p>
                  <span className="text-[11px] text-[var(--muted)]">Ej: {deliveryAddress.roadType} 25 # 10-32</span>
                </div>

                <div className="mt-3 grid gap-2 sm:gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_0.9fr]">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Tipo de vía</span>
                      <select
                        value={deliveryAddress.roadType}
                        onChange={(event) =>
                          setDeliveryAddress((current) => ({
                            ...current,
                            roadType: event.target.value as AddressRoadType,
                          }))
                        }
                        className="app-input"
                      >
                        {ADDRESS_ROAD_TYPE_OPTIONS.map((roadType) => (
                          <option key={roadType} value={roadType}>
                            {roadType}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Número principal</span>
                      <input
                        value={deliveryAddress.mainNumber}
                        onChange={(event) =>
                          setDeliveryAddress((current) => ({
                            ...current,
                            mainNumber: event.target.value,
                          }))
                        }
                        inputMode="numeric"
                        className="app-input text-center font-semibold tabular-nums"
                        placeholder="25"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Después de #</span>
                      <input
                        value={deliveryAddress.secondaryNumber}
                        onChange={(event) =>
                          setDeliveryAddress((current) => ({
                            ...current,
                            secondaryNumber: event.target.value,
                          }))
                        }
                        inputMode="numeric"
                        className="app-input text-center font-semibold tabular-nums"
                        placeholder="10"
                      />
                    </label>

                    <span className="pb-2 text-center text-sm font-semibold text-[var(--muted)]">-</span>

                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Número final</span>
                      <input
                        value={deliveryAddress.propertyNumber}
                        onChange={(event) =>
                          setDeliveryAddress((current) => ({
                            ...current,
                            propertyNumber: event.target.value,
                          }))
                        }
                        inputMode="numeric"
                        className="app-input text-center font-semibold tabular-nums"
                        placeholder="32"
                      />
                    </label>

                    <span className="hidden pb-2 text-center text-sm font-semibold text-[var(--muted)] sm:block">#</span>

                    <div className="hidden rounded-xl border border-dashed border-[var(--line)] bg-white px-2 py-2 text-center text-[11px] text-[var(--muted)] sm:block">
                      {deliveryAddress.roadType} {deliveryAddress.mainNumber.trim() || '__'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink)]">
                  <span className="font-semibold">Vista previa:</span>{' '}
                  {deliveryAddress.mainNumber.trim() || deliveryAddress.secondaryNumber.trim() || deliveryAddress.propertyNumber.trim()
                    ? `${deliveryAddress.roadType} ${deliveryAddress.mainNumber.trim() || '__'} # ${deliveryAddress.secondaryNumber.trim() || '__'}-${deliveryAddress.propertyNumber.trim() || '__'}`
                    : 'Completa la numeración para ver la dirección.'}
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Complemento (opcional)</label>
                  <input
                    value={deliveryAddress.complement}
                    onChange={(event) =>
                      setDeliveryAddress((current) => ({
                        ...current,
                        complement: event.target.value,
                      }))
                    }
                    className="app-input"
                    placeholder="Apto 302, torre 2, casa 8, conjunto, piso"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Referencia de llegada</label>
                  <input
                    value={deliveryAddress.reference}
                    onChange={(event) =>
                      setDeliveryAddress((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    className="app-input"
                    placeholder="Portón negro, frente a la tienda, casa esquinera"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                <span className="font-semibold">Así enviaremos tu dirección:</span>{' '}
                {deliveryAddress.neighborhood.trim() && deliveryAddress.mainNumber.trim() && deliveryAddress.secondaryNumber.trim() && deliveryAddress.propertyNumber.trim()
                  ? formattedDeliveryAddress
                  : 'Completa barrio y numeración para ver la dirección final.'}
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Teléfono</label>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className="app-input" placeholder="Tu número de contacto" />
              </div>
            </div>
          ) : null}
        </div>

        {checkoutMessage ? <p className="mt-4 rounded-[1.4rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] shadow-sm">{checkoutMessage}</p> : null}

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={onCheckout}
            disabled={checkingOut || cartItems.length === 0}
            className="w-full rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-sky-900/15 transition disabled:cursor-not-allowed disabled:opacity-55"
          >
            {checkingOut ? 'Procesando...' : hasToken ? 'Confirmar compra' : 'Inicia sesión para comprar'}
          </button>

          {!hasToken ? (
            <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Necesitas iniciar sesión para confirmar pedidos y usar tu wallet.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function getStoreScopedKey(prefix: string, userId: string): string {
  return `${prefix}:${userId}`;
}