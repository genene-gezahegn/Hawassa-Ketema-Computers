import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Heart,
  LogOut,
  Menu,
  PackageCheck,
  Search,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { Category, Product } from '../lib/inventory';
import { useInventoryStore } from '../store/inventoryStore';
import CustomerDemoEntry from './CustomerDemoEntry';
import CustomerAuth from './CustomerAuth';
import { apiRequest, ApiRequestError, clearSession, getToken, ApiUser, loadApiProducts, uploadPaymentReceipt } from '../lib/api';
import CustomerCatalog from './CustomerCatalog';
import { CustomerCheckout, CustomerOrders, CustomerDashboardOverview } from './CustomerOrderViews';
import CustomerProductDialogs from './CustomerProductDialogs';
import CustomerSettingsPanel from './CustomerSettingsPanel';
import CustomerFooter from './CustomerFooter';
import {
  CatalogSort,
  CheckoutDetails,
  CustomerOrder,
  CustomerProfile,
  CustomerTab,
  paymentBankOptions,
} from './customerStorefrontTypes';

export default function CustomerStorefront() {
  const { products, setProducts, setUserRole, setCurrentUser, setActiveView } = useInventoryStore();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [authMode, setAuthMode] = useState<'customer'|'admin'|null>(() =>
    new URLSearchParams(window.location.search).has('resetToken') ? 'customer' : null
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [apiCatalog, setApiCatalog] = useState<Product[] | null>(null);
  const [apiCatalogError, setApiCatalogError] = useState('');
  const [activeTab, setActiveTab] = useState<CustomerTab>('home');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [sortBy, setSortBy] = useState<CatalogSort>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [orderNotice, setOrderNotice] = useState('');
  const [orderError, setOrderError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const orderSubmissionKey = useRef<string | null>(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentInstructions,setPaymentInstructions]=useState({bankName:'Bank transfer',accountName:'Store account',accountNumber:'',instructions:'Transfer the exact order total and submit your transaction reference.'});
  const [checkout, setCheckout] = useState<CheckoutDetails>({
    name: '',
    email: '',
    phone: '',
    address: '',
    paymentMethod: 'Cash on delivery',
    bank: 'cbe',
    bankTransactionReference: '',
    senderName: '',
    receiptFile: null,
  });

  const storefrontProducts = authenticated ? apiCatalog || [] : products;
  const catalogProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return storefrontProducts.filter((product) => {
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const matchesAvailability = !inStockOnly || product.stockQuantity > 0;
      const matchesSearch =
        !query ||
        [product.name, product.brand, product.model, product.sku, product.specs]
          .some((value) => value.toLowerCase().includes(query));
      return matchesCategory && matchesAvailability && matchesSearch;
    }).sort((left, right) => {
      if (sortBy === 'price-low') return left.price - right.price;
      if (sortBy === 'price-high') return right.price - left.price;
      if (sortBy === 'name') return left.name.localeCompare(right.name);
      return Number(right.stockQuantity > 0) - Number(left.stockQuantity > 0);
    });
  }, [storefrontProducts, search, selectedCategory, inStockOnly, sortBy]);

  const wishlistProducts = catalogProducts.filter((product) => wishlist.includes(product.id));
  const visibleProducts = activeTab === 'wishlist' ? wishlistProducts : catalogProducts;
  const compareProducts = compareIds
    .map((productId) => storefrontProducts.find((product) => product.id === productId))
    .filter((product): product is Product => Boolean(product));
  const recentlyViewedProducts = recentlyViewedIds
    .map((productId) => storefrontProducts.find((product) => product.id === productId))
    .filter((product): product is Product => Boolean(product));
  const featuredProduct = storefrontProducts.find((product) => product.stockQuantity > 0 && product.productPhoto) || storefrontProducts[0] || products[0];

  const cartLines = useMemo(
    () => Object.entries(cart)
      .map(([productId, quantity]) => ({
        product: storefrontProducts.find((item) => item.id === productId),
        quantity,
      }))
      .filter((line): line is { product: Product; quantity: number } => Boolean(line.product && line.quantity > 0)),
    [cart, products]
  );
  const cartCount = cartLines.reduce((total, line) => total + line.quantity, 0);
  const cartTotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const openAccount = () => setAuthMode('customer');

  const handleAuthSuccess = (user: ApiUser) => {
    if (user.role === 'admin') { setUserRole('Admin'); setCurrentUser(`${user.fullName} (Admin)`); setActiveView('dashboard'); return; }
    if (user.role === 'employee') { setUserRole('Employee'); setCurrentUser(`${user.fullName} (Employee)`); return; }
    if (user.role === 'delivery_person') { setUserRole('Delivery'); setCurrentUser(`${user.fullName} (Delivery)`); return; }
    setCustomer({ name: user.fullName, email: user.email });
    setCustomerPhone(user.phone || '');
    setCheckout((current) => ({ ...current, name: user.fullName, email: user.email, phone: user.phone || '' }));
    setAuthenticated(true); setAuthMode(null); setActiveTab('home');
    apiRequest<{orders: CustomerOrder[]}>('/orders/mine').then((data) => setOrders(data.orders || [])).catch(() => setOrders([]));
  };

  const refreshOrders = () => {
    apiRequest<{orders: CustomerOrder[]}>('/orders/mine').then((data) => setOrders(data.orders || [])).catch(() => {});
  };

  useEffect(() => {
    apiRequest<typeof paymentInstructions>('/payments/instructions').then(setPaymentInstructions).catch(()=>{});
    loadApiProducts().then((items) => {
      setApiCatalog(items);
      if (items.length) setProducts(items);
    }).catch((error) => {
      setApiCatalog([]);
      setApiCatalogError(error instanceof Error ? error.message : 'Unable to load the customer catalog.');
    });
    if (!getToken()) return;
    apiRequest<{user: ApiUser}>('/auth/me').then(({user}) => {
      if (user.role === 'admin') { setUserRole('Admin'); setCurrentUser(`${user.fullName} (Admin)`); setActiveView('dashboard'); }
      else handleAuthSuccess(user);
    }).catch((error) => {
      if (error instanceof ApiRequestError && error.status === 401) clearSession();
    });
  // Session restoration runs once when the storefront mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterDemoStore = () => {
    const demoCustomer = { name: 'Demo Customer', email: 'guest@demo.local' };
    setCustomer(demoCustomer);
    setCheckout((current) => ({ ...current, ...demoCustomer }));
  };
  const openDemoTab = (tab: CustomerTab) => {
    setActiveTab(tab);
    enterDemoStore();
  };
  const searchDemoCatalog = (query: string) => {
    setSearch(query);
    openDemoTab('catalog');
  };
  const openDemoCategory = (category: Category | 'All') => {
    setSelectedCategory(category);
    openDemoTab('catalog');
  };
  const openDemoProduct = (product: Product) => {
    openDemoTab('catalog');
    openProductDetails(product);
  };

  const updateCart = (product: Product, change: number) => {
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(product.stockQuantity, (current[product.id] || 0) + change));
      const next = { ...current };
      if (nextQuantity === 0) delete next[product.id];
      else next[product.id] = nextQuantity;
      return next;
    });
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
  };

  const toggleCompare = (productId: string) => {
    setCompareIds((current) => {
      if (current.includes(productId)) return current.filter((id) => id !== productId);
      if (current.length >= 3) return current;
      return [...current, productId];
    });
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setRecentlyViewedIds((current) => [product.id, ...current.filter((id) => id !== product.id)].slice(0, 4));
  };

  const addProductToCartFromDetails = (product: Product) => {
    updateCart(product, 1);
    setSelectedProduct(null);
    setActiveTab('cart');
  };

  const handlePlaceOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!authenticated || !getToken()) { setAuthMode('customer'); return; }
    if (placingOrder) return;
    setOrderError('');
    setOrderNotice('');
    const name=checkout.name.trim();
    const email=checkout.email.trim();
    const phone=checkout.phone.trim().replace(/[\s()-]/g,'');
    const address=checkout.address.trim();
    const methods=['Cash on delivery','Bank transfer','Pay on pickup'];
    if(name.length<2 || !/\p{L}/u.test(name)){setOrderError('Enter your full name.');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setOrderError('Enter a valid email address.');return;}
    if(!/^(?:0[79]\d{8}|\+251[79]\d{8})$/.test(phone)){setOrderError('Use a valid Ethiopian phone number, such as 0912345678.');return;}
    if(address.length<5){setOrderError('Enter a delivery address (at least 5 characters).');return;}
    if(!methods.includes(checkout.paymentMethod)){setOrderError('Choose a supported payment method.');return;}
    if(checkout.paymentMethod==='Bank transfer'){
      if(!paymentBankOptions.some(({value})=>value===checkout.bank)){setOrderError('Choose a supported bank or wallet.');return;}
      if(checkout.bankTransactionReference.trim().length<5 || checkout.bankTransactionReference.trim().length>180){setOrderError('Enter a transaction reference between 5 and 180 characters.');return;}
      if(checkout.senderName.trim().length>120){setOrderError('Sender name must be 120 characters or fewer.');return;}
      if(checkout.receiptFile && !['image/jpeg','image/png','image/webp','application/pdf'].includes(checkout.receiptFile.type)){setOrderError('Choose a JPG, PNG, WebP, or PDF receipt.');return;}
      if(checkout.receiptFile && checkout.receiptFile.size>5*1024*1024){setOrderError('Receipt file must be 5 MB or smaller.');return;}
    }
    if(cartLines.length===0 || cartLines.length>30 || cartLines.some(({product,quantity})=>!product.id || !Number.isInteger(quantity) || quantity<1 || quantity>100)){
      setOrderError('Your cart must contain valid products with whole-number quantities.');
      return;
    }
    setPlacingOrder(true);
    let createdOrderNumber='';
    let paymentReceiptSubmitted=false;
    try {
      const idempotencyKey=orderSubmissionKey.current || crypto.randomUUID();
      orderSubmissionKey.current=idempotencyKey;
      const result = await apiRequest<{order:{id:string;orderNumber:string}}>( '/orders', { method:'POST', body:JSON.stringify({ idempotencyKey, customerName:name, phone, deliveryAddress:address, paymentMethod:checkout.paymentMethod, items:cartLines.map(({product,quantity})=>({productId:product.id,quantity})) }) });
      createdOrderNumber=result.order.orderNumber;
      orderSubmissionKey.current=null;
      setCart({}); setActiveTab('orders');
      if(checkout.paymentMethod==='Bank transfer'){
        await uploadPaymentReceipt(result.order.id, {
          bank: checkout.bank,
          reference: checkout.bankTransactionReference.trim(),
          senderName: checkout.senderName.trim(),
          receipt: checkout.receiptFile,
        });
        paymentReceiptSubmitted=true;
      }
      setOrderNotice(checkout.paymentMethod==='Bank transfer'
        ? `Order ${result.order.orderNumber} was submitted successfully. Transfer details are awaiting staff verification.`
        : `Order ${result.order.orderNumber} was submitted successfully.`);
      try{
        const refreshed = await apiRequest<{orders:Array<Record<string, any>>}>('/orders/mine');
        setOrders(refreshed.orders.map((o) => ({id:o.id,orderNumber:o.orderNumber,createdAt:o.createdAt,customerName:o.customerName,email:customer?.email||'',phone:o.phone,address:o.deliveryAddress,paymentMethod:o.paymentMethod,paymentStatus:o.paymentStatus,receiptPaymentId:o.receiptPaymentId,receiptBank:o.receiptBank,bankTransactionReference:o.bankTransactionReference,receiptReviewNote:o.receiptReviewNote,receiptSubmittedAt:o.receiptSubmittedAt,deliveryStatus:o.deliveryStatus,deliveryNote:o.deliveryNote,failureReason:o.failureReason,deliveryPersonName:o.deliveryPersonName,deliveryPersonPhone:o.deliveryPersonPhone,assignedAt:o.assignedAt,acceptedAt:o.acceptedAt,outForDeliveryAt:o.outForDeliveryAt,deliveredAt:o.deliveredAt,failedAt:o.failedAt,cancellationStatus:o.cancellationStatus,items:o.items.map((i:any)=>({productId:i.productId,name:i.name,sku:i.sku,quantity:i.quantity,unitPrice:i.unitPrice})),total:Number(o.total),status:o.status})));
      }catch{ /* The order is already saved; the Orders view can be refreshed separately. */ }

    } catch (error) { const message=error instanceof Error ? error.message : 'Unable to place order.';
      if(createdOrderNumber && checkout.paymentMethod==='Bank transfer' && !paymentReceiptSubmitted) setOrderError(`Order ${createdOrderNumber} was created, but the transfer details could not be submitted: ${message}. Open Orders to review its status and submit them there.`);
      else if(createdOrderNumber) setOrderNotice(`Order ${createdOrderNumber} was created, but its details could not be refreshed: ${message}. Open Orders to review its status.`);
      else setOrderError(message);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (authMode) return <CustomerAuth mode={authMode} onBack={() => setAuthMode(null)} onSuccess={handleAuthSuccess} />;

  if (!customer) {
    return (
      <CustomerDemoEntry
        featuredProduct={featuredProduct}
        products={products}
        productCount={products.length}
        cartCount={cartCount}
        savedCount={wishlist.length}
        onEnterDemo={() => { enterDemoStore(); setActiveTab('catalog'); }}
        onSelectTab={openDemoTab}
        onSelectCategory={openDemoCategory}
        onOpenProduct={openDemoProduct}
        onSearch={searchDemoCatalog}
        onAccount={openAccount}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950 text-white">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          {/* Settings sidebar icon — top left */}
          <button
            type="button"
            onClick={() => setSettingsPanelOpen(true)}
            className="shrink-0 rounded-lg p-2 text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            aria-label="Open settings"
          >
            <Menu size={20} />
          </button>

          <button type="button" onClick={() => { setActiveTab('catalog'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex min-w-0 items-center gap-3 text-left" aria-label="Hawassa-Ketema catalog">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-700 font-black text-white">HK</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight sm:text-base">Hawassa-Ketema</p>
              <p className="hidden text-[9px] uppercase tracking-[0.16em] text-neutral-400 sm:block">Computers · Hawassa</p>
            </div>
          </button>

          <nav className="flex shrink-0 items-center gap-1" aria-label="Customer navigation">
            <button type="button" onClick={() => { setActiveTab('catalog'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`inline-flex items-center gap-1.5 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm ${activeTab === 'catalog' ? 'border-b-2 border-red-600 text-white' : 'rounded text-neutral-300 transition hover:text-white'}`} aria-label="Home" aria-current={activeTab === 'catalog' ? 'page' : undefined}>
              <Store size={16} /><span className="hidden sm:inline">Shop</span>
            </button>
            <button type="button" onClick={() => setActiveTab('wishlist')} className={`inline-flex items-center gap-1.5 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm ${activeTab === 'wishlist' ? 'border-b-2 border-red-600 text-white' : 'rounded text-neutral-300 transition hover:text-white'}`} aria-label={`Saved products, ${wishlist.length} items`} title="Saved products">
              <Heart size={16} /><span className="hidden sm:inline">Saved</span>
            </button>
            <button type="button" onClick={() => setActiveTab('orders')} className={`inline-flex items-center gap-1.5 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm ${activeTab === 'orders' ? 'border-b-2 border-red-600 text-white' : 'rounded text-neutral-300 transition hover:text-white'}`} aria-label="Orders" title="Orders">
              <PackageCheck size={16} /><span className="hidden sm:inline">Orders</span>
            </button>
            <button type="button" onClick={() => setActiveTab('cart')} className={`inline-flex items-center gap-1.5 px-2 py-2 text-xs font-bold sm:px-3 sm:text-sm ${activeTab === 'cart' ? 'border-b-2 border-red-600 text-white' : 'rounded text-neutral-300 transition hover:text-white'}`} aria-label={`Cart, ${cartCount} items`} title="Cart">
              <ShoppingBag size={16} /><span className="hidden sm:inline">Cart</span><span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[10px]">{cartCount}</span>
            </button>
          </nav>

          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <label className="hidden h-9 w-40 items-center gap-2 rounded-full bg-white/10 px-3 text-neutral-300 focus-within:ring-2 focus-within:ring-red-500 md:flex md:w-48 lg:w-56">
              <Search size={15} className="shrink-0" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setActiveTab('catalog'); }} placeholder="Search products..." aria-label="Search products" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-neutral-400" />
            </label>
            {authenticated && <button type="button" onClick={() => { clearSession(); setAuthenticated(false); setCustomer(null); setOrders([]); }} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-neutral-200 transition hover:text-white sm:text-sm"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {orderNotice && (
          <div role="status" className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={18} /> {orderNotice}
            <button type="button" className="ml-auto text-emerald-900" onClick={() => setOrderNotice('')} aria-label="Dismiss order notice">×</button>
          </div>
        )}
        {orderError && (
          <div role="alert" className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span className="shrink-0 text-lg leading-none">⚠</span> {orderError}
            <button type="button" className="ml-auto text-red-900" onClick={() => setOrderError('')} aria-label="Dismiss error">×</button>
          </div>
        )}
        {authenticated && apiCatalogError && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Unable to load the current store catalog: {apiCatalogError}
          </div>
        )}
        {authenticated && !apiCatalogError && apiCatalog?.length === 0 && (
          <div role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            The shop has no published products yet. Ask an administrator to publish real inventory.
          </div>
        )}

        {(activeTab === 'catalog' || activeTab === 'wishlist') && (
          <CustomerCatalog
            products={storefrontProducts}
            featuredProduct={featuredProduct}
            customer={customer}
            activeTab={activeTab}
            visibleProducts={visibleProducts}
            recentlyViewedProducts={recentlyViewedProducts}
            cart={cart}
            wishlist={wishlist}
            compareIds={compareIds}
            search={search}
            selectedCategory={selectedCategory}
            sortBy={sortBy}
            inStockOnly={inStockOnly}
            onSearchChange={setSearch}
            onCategoryChange={setSelectedCategory}
            onSortChange={setSortBy}
            onAvailabilityChange={setInStockOnly}
            onToggleWishlist={toggleWishlist}
            onToggleCompare={toggleCompare}
            onUpdateCart={updateCart}
            onOpenProduct={openProductDetails}
            onOpenComparison={() => setCompareOpen(true)}
          />
        )}

        {activeTab === 'cart' && (
          <CustomerCheckout
            cartLines={cartLines}
            cartTotal={cartTotal}
            checkout={checkout}
            onCheckoutChange={(updates) => setCheckout((current) => ({ ...current, ...updates }))}
            onUpdateCart={updateCart}
            onPlaceOrder={handlePlaceOrder}
            placingOrder={placingOrder}
            onBrowseCatalog={() => setActiveTab('catalog')}
            paymentInstructions={paymentInstructions}
          />
        )}

        {activeTab === 'orders' && (
          <CustomerOrders orders={orders} email={customer.email} onBrowseCatalog={() => setActiveTab('catalog')} onOrdersRefresh={refreshOrders} />
        )}

        {activeTab === 'home' && (
          <CustomerDashboardOverview
            orders={orders}
            customerName={customer.name}
            onViewOrders={() => setActiveTab('orders')}
            onViewOrder={() => setActiveTab('orders')}
            onBrowseCatalog={() => setActiveTab('catalog')}
          />
        )}
      </main>

      <CustomerFooter onNavigate={setActiveTab} />

      {compareProducts.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-300 bg-white/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold">Compare products <span className="text-neutral-500">({compareProducts.length}/3)</span></p>
              <p className="text-xs text-neutral-500 truncate">{compareProducts.map((product) => product.name).join(' · ')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setCompareIds([])} className="rounded-lg px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100">Clear</button>
              <button type="button" onClick={() => setCompareOpen(true)} disabled={compareProducts.length < 2} className="rounded-lg bg-neutral-900 px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-40">Compare now</button>
            </div>
          </div>
        </div>
      )}

      <CustomerProductDialogs
        selectedProduct={selectedProduct}
        compareOpen={compareOpen}
        compareProducts={compareProducts}
        wishlist={wishlist}
        onCloseProduct={() => setSelectedProduct(null)}
        onToggleWishlist={toggleWishlist}
        onAddToCart={addProductToCartFromDetails}
        onCloseComparison={() => setCompareOpen(false)}
        onRemoveComparison={toggleCompare}
      />

      <CustomerSettingsPanel
        open={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        authenticated={authenticated}
        customerName={customer?.name ?? ''}
        customerPhone={customerPhone}
        onSignIn={() => { setSettingsPanelOpen(false); openAccount(); }}
        onSignOut={() => {
          clearSession();
          setAuthenticated(false);
          setCustomer(null);
          setOrders([]);
          setCustomerPhone('');
        }}
        onProfileUpdated={(user) => {
          setCustomer({ name: user.fullName, email: user.email });
          setCustomerPhone(user.phone || '');
          setCheckout((current) => ({ ...current, name: user.fullName, phone: user.phone || '' }));
        }}
      />
    </div>
  );
}
