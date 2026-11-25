import React, { useState } from 'react';
import {
  getDashboardCounts,
  Product,
  Category,
  StockStatus,
  getStockStatus,
} from './lib/inventory';
import { getRolePermissions, useInventoryStore } from './store/inventoryStore';
import NavigationDrawer from './components/NavigationDrawer';
import InventoryPage from './components/InventoryPage';
import ProductDetailsPage from './components/ProductDetailsPage';
import AddItemForm from './components/AddItemForm';
import StockOutView from './components/StockOutView';
import OutOfStockPage from './components/OutOfStockPage';
import LowStockPage from './components/LowStockPage';
import ReportsView from './components/ReportsView';
import StockHistoryView from './components/StockHistoryView';
import SettingsView from './components/SettingsView';
import Scan from './components/Scan';
import CustomerStorefront from './components/CustomerStorefront';
import { clearSession } from './lib/api';
import AdminOrders from './components/AdminOrders';
import EmployeeDashboard from './components/EmployeeDashboard';
import DeliveryDashboard from './components/DeliveryDashboard';
import StaffManagement from './components/StaffManagement';
import DeliveryManagement from './components/DeliveryManagement';

export default function App() {
  const {
    products,
    currentUserRole,
    activeView,
    selectedCategory,
    selectedStatus,
    searchQuery,
    isSearchOpen,
    isMenuOpen,
    unreadNotifications,
    setActiveView,
    viewProductDetails,
    setSelectedCategory,
    setSelectedStatus,
    setSearchQuery,
    toggleSearch,
    setMenuOpen,
    clearNotificationBadge,
    updateStock,
    resetFilters,
    setUserRole,
    setCurrentUser,
  } = useInventoryStore();

  // Directly connect summary cards to getDashboardCounts() from src/lib/inventory.ts
  const dashboardCounts = getDashboardCounts(products);
  const permissions = getRolePermissions(currentUserRole);

  const [notificationOpen, setNotificationOpen] = useState(false);

  const handleSearchClick = () => {
    if (isSearchOpen) {
      toggleSearch();
      return;
    }
    resetFilters();
    setActiveView('inventory');
    toggleSearch();
  };

  // Category card definitions as required by Section 2
  const categories: Array<{
    name: Category;
    emoji: string;
    description: string;
    badgeCount: number;
  }> = [
    {
      name: 'Laptop',
      emoji: '💻',
      description: 'Laptops, Notebooks & Ultrabooks',
      badgeCount: products.filter((p) => p.category === 'Laptop').length,
    },
    {
      name: 'Desktop',
      emoji: '🖥️',
      description: 'Tower PCs, All-in-Ones & Workstations',
      badgeCount: products.filter((p) => p.category === 'Desktop').length,
    },
    {
      name: 'Power Solutions',
      emoji: '⚡',
      description: 'UPS Systems, Inverters & Batteries',
      badgeCount: products.filter((p) => p.category === 'Power Solutions').length,
    },
    {
      name: 'Accessories',
      emoji: '🔧',
      description: 'Monitors, Mice, Adapters & Storage',
      badgeCount: products.filter((p) => p.category === 'Accessories').length,
    },
  ];

  // Helper for status badge styling based on master spec:
  // - Green for In Stock
  // - Orange for Low Stock
  // - Red for Out of Stock
  // - Gray for inactive/neutral
  const getStatusBadge = (status: StockStatus) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            In Stock
          </span>
        );
      case 'low_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Low Stock
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Out of Stock
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            Neutral
          </span>
        );
    }
  };

  // Filter products for the dashboard view
  const dashboardProducts = products.filter((item) => {
    if (selectedCategory && item.category !== selectedCategory) {
      return false;
    }
    const itemStatus = getStockStatus(item);
    if (selectedStatus !== 'all' && itemStatus !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const match =
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.specs.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (currentUserRole === 'Customer') {
    return <CustomerStorefront />;
  }

  if (currentUserRole === 'Employee') {
    return <EmployeeDashboard />;
  }

  if (currentUserRole === 'Delivery') {
    return <DeliveryDashboard />;
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans flex flex-col antialiased">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION 4: HEADER (Red Header, Black/White/Red Theme, Mobile-First) */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 bg-red-700 text-white shadow-md transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Hamburger menu on the left */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(!isMenuOpen)}
                className="shrink-0 p-2.5 rounded-xl hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95 transition-all text-white flex items-center justify-center min-h-[44px] min-w-[44px]"
                aria-label="Open hamburger menu"
              >
                <svg
                  className="w-6 h-6 stroke-current"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {isMenuOpen ? (
                    <path d="M18 6L6 18M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* Hawassa-Ketema text/logo */}
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setActiveView('dashboard');
                }}
                className="flex min-w-0 items-center gap-2 sm:gap-2.5 cursor-pointer select-none group"
                aria-label="Go to dashboard"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-white text-red-700 flex items-center justify-center font-black shadow-inner tracking-tighter text-lg">
                  HK
                </div>
                <div className="hidden min-[360px]:flex min-w-0 flex-col">
                  <span className="truncate whitespace-nowrap font-extrabold text-base sm:text-xl tracking-tight leading-tight text-white group-hover:text-red-100 transition-colors">
                    Hawassa-Ketema
                  </span>
                  <span className="hidden sm:block text-[10px] sm:text-xs font-medium tracking-wider text-red-200 uppercase -mt-0.5">
                    Computers
                  </span>
                </div>
              </button>
            </div>

            {/* Quick Action Navigation Links for Desktop */}
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeView === 'dashboard' ? 'bg-red-800 text-white' : 'hover:bg-red-800/60 text-red-100'
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus('all');
                  setSelectedCategory(null);
                  setActiveView('inventory');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeView === 'inventory' ? 'bg-red-800 text-white' : 'hover:bg-red-800/60 text-red-100'
                }`}
              >
                All Inventory
              </button>
              {currentUserRole === 'Admin' && <button type="button" onClick={() => setActiveView('orders')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeView === 'orders' ? 'bg-red-800 text-white' : 'hover:bg-red-800/60 text-red-100'}`}>Orders</button>}
              {currentUserRole === 'Admin' && <button type="button" onClick={() => setActiveView('staff')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeView === 'staff' ? 'bg-red-800 text-white' : 'hover:bg-red-800/60 text-red-100'}`}>Staff</button>}
              {currentUserRole === 'Admin' && <button type="button" onClick={() => setActiveView('delivery_mgmt')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeView === 'delivery_mgmt' ? 'bg-red-800 text-white' : 'hover:bg-red-800/60 text-red-100'}`}>Deliveries</button>}
              {permissions.canAddProduct && <button
                type="button"
                onClick={() => setActiveView('add_item')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-colors flex items-center gap-1.5 ${
                  activeView === 'add_item'
                    ? 'bg-white text-red-700 shadow'
                    : 'bg-white/10 hover:bg-white hover:text-red-700 text-white'
                }`}
              >
                <span>+</span> Add Item
              </button>}
            </div>

            {/* Right Header Actions: Scanner, Search & Notification */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {/* Barcode & QR Scanner Button */}
              <button
                type="button"
                onClick={() => setActiveView('scan')}
                className={`hidden sm:flex p-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/50 min-h-[44px] min-w-[44px] items-center justify-center ${
                  activeView === 'scan' ? 'bg-red-800 text-white' : 'hover:bg-red-800/80 text-white'
                }`}
                aria-label="Barcode and QR scanner"
                title="Scan Barcode / QR Code"
              >
                <span className="text-base select-none">📷</span>
              </button>

              {/* Search Icon */}
              <button
                type="button"
                onClick={handleSearchClick}
                className={`p-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/50 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  isSearchOpen ? 'bg-red-800 text-white' : 'hover:bg-red-800/80 text-white'
                }`}
                aria-label="Toggle search"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>

              {/* Optional Notification Icon */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen(!notificationOpen);
                    clearNotificationBadge();
                  }}
                  className="p-2.5 rounded-xl hover:bg-red-800/80 focus:outline-none focus:ring-2 focus:ring-white/50 min-h-[44px] min-w-[44px] flex items-center justify-center text-white transition-all relative"
                  aria-label="Notifications"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-white text-red-700 text-[10px] font-black items-center justify-center shadow">
                        {unreadNotifications}
                      </span>
                    </span>
                  )}
                </button>

                {/* Notifications Popup Dropdown */}
                {notificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-neutral-200 py-3 text-neutral-800 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
                      <span className="font-bold text-sm text-neutral-900">Inventory Alerts</span>
                      <span className="text-xs text-red-600 font-medium">3 stock updates</span>
                    </div>
                    <div className="divide-y divide-neutral-100 text-xs">
                      <div className="px-4 py-2.5 hover:bg-neutral-50 transition-colors">
                        <p className="font-semibold text-amber-800 flex items-center gap-1">
                          ⚠️ Low Stock Warning
                        </p>
                        <p className="text-neutral-600 mt-0.5">
                          Lenovo ThinkPad E14 has only 2 units left.
                        </p>
                      </div>
                      <div className="px-4 py-2.5 hover:bg-neutral-50 transition-colors">
                        <p className="font-semibold text-red-700 flex items-center gap-1">
                          🛑 Out of Stock
                        </p>
                        <p className="text-neutral-600 mt-0.5">
                          Apple MacBook Air M2 is completely sold out.
                        </p>
                      </div>
                      <div className="px-4 py-2.5 hover:bg-neutral-50 transition-colors">
                        <p className="font-semibold text-red-700 flex items-center gap-1">
                          🛑 Out of Stock
                        </p>
                        <p className="text-neutral-600 mt-0.5">
                          Ritar Deep Cycle Battery 100Ah needs restock.
                        </p>
                      </div>
                    </div>
                    <div className="px-4 pt-2 border-t border-neutral-100">
                      <button
                        onClick={() => setNotificationOpen(false)}
                        className="w-full text-center text-xs font-semibold text-red-600 hover:text-red-700 py-1"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { clearSession(); setUserRole('Customer'); setCurrentUser('Guest'); }} className="ml-1 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-2 text-xs font-bold text-white" title="Sign out of administrator account">Sign out</button>
            </div>
          </div>

          {/* Expandable Mobile Search Bar */}
          {isSearchOpen && (
            <div className="pb-3.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products by model, brand, SKU or specs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveView('inventory');
                  }}
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white text-neutral-900 placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-white shadow-lg font-medium"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3: HAMBURGER MENU (Slide-out Drawer with 9 Clean Items) */}
      {/* ------------------------------------------------------------------ */}
      <NavigationDrawer />

      {/* ------------------------------------------------------------------ */}
      {/* MAIN VIEW ROUTER */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 w-full">
        {/* ROUTE 1: ALL INVENTORY PAGE (SECTION 14) */}
        {activeView === 'inventory' && <InventoryPage />}

        {/* ROUTE 2: PRODUCT DETAILS PAGE (SECTION 12 & SECTION 7) */}
        {activeView === 'product_details' && <ProductDetailsPage />}

        {/* ROUTE 3: ADD ITEM FORM (SECTION 5) */}
        {activeView === 'add_item' && permissions.canAddProduct && <AddItemForm />}

        {/* ROUTE 4: STOCK OUT DISPATCH (SECTION 8) */}
        {activeView === 'stock_out' && permissions.canManageStock && <StockOutView />}

        {/* ROUTE 5: OUT OF STOCK PAGE (SECTION 15) */}
        {activeView === 'out_of_stock' && <OutOfStockPage />}

        {/* ROUTE 6: LOW STOCK PAGE (SECTION 16) */}
        {activeView === 'low_stock' && <LowStockPage />}

        {/* ROUTE 7: REPORTS & ANALYTICS (SECTION 17) */}
        {activeView === 'reports' && <ReportsView />}

        {/* ROUTE 8: STOCK AUDIT HISTORY (SECTION 13) */}
        {activeView === 'stock_history' && <StockHistoryView />}

        {/* ROUTE 9: SETTINGS */}
        {activeView === 'settings' && <SettingsView />}

        {/* ROUTE 10: BARCODE & QR SCANNER */}
        {activeView === 'scan' && <Scan />}
        {activeView === 'orders' && currentUserRole === 'Admin' && <AdminOrders />}
        {activeView === 'staff' && currentUserRole === 'Admin' && <StaffManagement />}
        {activeView === 'delivery_mgmt' && currentUserRole === 'Admin' && <DeliveryManagement isAdmin />}

        {/* ROUTE 11 & DEFAULT: MAIN DASHBOARD (SECTION 2) */}
        {activeView === 'dashboard' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 sm:space-y-8">
            {/* Top Welcome & Navigation Kicker */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200/80 pb-4">
              <div>
                <span className="inline-block text-xs font-bold uppercase tracking-widest text-red-700 mb-0.5">
                  Hawassa-Ketema Computers
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                  Main Dashboard
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedCategory(null);
                    setActiveView('inventory');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-extrabold text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
                >
                  📦 All Inventory
                </button>

              {permissions.canAddProduct && <button
                  type="button"
                  onClick={() => setActiveView('add_item')}
                  className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-xs shadow hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
                >
                  <span className="text-sm font-bold">+</span> Add Item
                </button>}
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* SECTION 2: TOP SUMMARY CARDS (Connected to getDashboardCounts()) */}
            {/* ------------------------------------------------------------ */}
            <section aria-labelledby="summary-cards-heading">
              <div className="flex items-center justify-between mb-3">
                <h2 id="summary-cards-heading" className="text-sm font-bold uppercase tracking-wider text-neutral-600">
                  Overview Summary
                </h2>
                {selectedStatus !== 'all' && (
                  <button
                    onClick={() => setSelectedStatus('all')}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 underline flex items-center gap-1"
                  >
                    Clear Status Filter ({selectedStatus.replace('_', ' ')})
                  </button>
                )}
              </div>

              {/* Keep summary cards readable on narrow phones before adding columns. */}
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total Products Card */}
                <div
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedCategory(null);
                    setActiveView('inventory');
                  }}
                  role="button"
                  tabIndex={0}
                  className={`min-w-0 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-md ${
                    selectedStatus === 'all' && !selectedCategory
                      ? 'bg-neutral-900 text-white border-neutral-900 ring-2 ring-neutral-900/20'
                      : 'bg-white text-neutral-900 border-neutral-200/90 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      selectedStatus === 'all' && !selectedCategory ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      1. Total Products
                    </span>
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      selectedStatus === 'all' && !selectedCategory ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-700'
                    }`}>
                      📦
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight">
                      {dashboardCounts.totalProducts}
                    </span>
                    <p className={`text-xs mt-1 ${
                      selectedStatus === 'all' && !selectedCategory ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      All registered items →
                    </p>
                  </div>
                </div>

                {/* 2. In Stock Card (Use Green for In Stock) */}
                <div
                  onClick={() => {
                    setSelectedStatus('in_stock');
                    setSelectedCategory(null);
                    setActiveView('inventory');
                  }}
                  role="button"
                  tabIndex={0}
                  className={`min-w-0 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-md ${
                    selectedStatus === 'in_stock'
                      ? 'bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-600/30'
                      : 'bg-white border-emerald-200/90 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      selectedStatus === 'in_stock' ? 'text-emerald-100' : 'text-emerald-700'
                    }`}>
                      2. In Stock
                    </span>
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      selectedStatus === 'in_stock' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      ✓
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className={`text-3xl sm:text-4xl font-black tracking-tight ${
                      selectedStatus === 'in_stock' ? 'text-white' : 'text-emerald-700'
                    }`}>
                      {dashboardCounts.inStock}
                    </span>
                    <p className={`text-xs mt-1 ${selectedStatus === 'in_stock' ? 'text-emerald-100' : 'text-emerald-700/80 font-medium'}`}>
                      Ready for sale →
                    </p>
                  </div>
                </div>

                {/* 3. Low Stock Card (Use Orange for Low Stock - Section 16) */}
                <div
                  onClick={() => setActiveView('low_stock')}
                  role="button"
                  tabIndex={0}
                  className="min-w-0 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-md bg-white border-amber-200/90 hover:border-amber-400"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      3. Low Stock
                    </span>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold bg-amber-100 text-amber-700">
                      ⚠️
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-amber-700">
                      {dashboardCounts.lowStock}
                    </span>
                    <p className="text-xs mt-1 text-amber-700/80 font-medium">
                      View urgent reorder queue →
                    </p>
                  </div>
                </div>

                {/* 4. Out of Stock Card (Use Red for Out of Stock - Section 15) */}
                <div
                  onClick={() => setActiveView('out_of_stock')}
                  role="button"
                  tabIndex={0}
                  className="min-w-0 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-md bg-white border-red-200/90 hover:border-red-400"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                      4. Out of Stock
                    </span>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold bg-red-100 text-red-700">
                      🛑
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-red-700">
                      {dashboardCounts.outOfStock}
                    </span>
                    <p className="text-xs mt-1 text-red-700/80 font-medium">
                      View depleted products →
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* SECTION 2: FOUR LARGE CATEGORY CARDS */}
            {/* 💻 Laptop | 🖥️ Desktop | ⚡ Power Solutions | 🔧 Accessories */}
            {/* MASTER SPEC ROUTING: Clicking a category navigates to Inventory page filtered by that category! */}
            {/* ------------------------------------------------------------ */}
            <section aria-labelledby="category-cards-heading">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 id="category-cards-heading" className="text-sm font-bold uppercase tracking-wider text-neutral-600">
                    Hardware Categories
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Click a category to view and filter all items in that category in the Inventory page.
                  </p>
                </div>
              </div>

              {/* Large Easy-to-Tap Rounded Category Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((cat) => {
                  return (
                    <div
                      key={cat.name}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setActiveView('inventory');
                      }}
                      role="button"
                      tabIndex={0}
                      className="relative overflow-hidden rounded-2xl p-5 border transition-all cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-xl bg-white text-neutral-900 border-neutral-200/90 hover:border-red-500 group"
                    >
                      {/* Category Accent Stripe */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-neutral-200 group-hover:bg-red-600 transition-colors" />

                      <div className="flex items-start justify-between">
                        <span className="text-4xl sm:text-5xl drop-shadow-sm select-none" role="img" aria-label={cat.name}>
                          {cat.emoji}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 group-hover:bg-red-50 group-hover:text-red-700 transition-colors">
                          {cat.badgeCount} {cat.badgeCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="mt-4">
                        <h3 className="text-lg sm:text-xl font-black tracking-tight leading-snug group-hover:text-red-700 transition-colors">
                          {cat.name}
                        </h3>
                        <p className="text-xs mt-1 leading-relaxed text-neutral-500">
                          {cat.description}
                        </p>
                      </div>

                      {/* Large easy-to-tap category selector button */}
                      <div className="mt-5 pt-3 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStatus('all');
                            setSelectedCategory(cat.name);
                            setActiveView('inventory');
                          }}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] bg-neutral-100 text-neutral-800 group-hover:bg-red-700 group-hover:text-white shadow-sm"
                        >
                          View {cat.name} Inventory →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* FEATURED INVENTORY PREVIEW (Clicking item goes to Product Details) */}
            {/* ------------------------------------------------------------ */}
            <section aria-labelledby="inventory-items-heading" className="space-y-4">
              <div className="flex items-center justify-between border-t border-neutral-200/80 pt-5">
                <div>
                  <h2 id="inventory-items-heading" className="text-base font-black text-neutral-900 tracking-tight flex items-center gap-2">
                    <span>Featured Hardware Catalog</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">
                      {dashboardProducts.length}
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Click any product card to inspect full specifications, pricing, and serial numbers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedCategory(null);
                    setActiveView('inventory');
                  }}
                  className="text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                >
                  View All in Inventory →
                </button>
              </div>

              {/* Product Items Grid: Mobile-First Responsive Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardProducts.slice(0, 6).map((item: Product) => {
                  const currentStatus = getStockStatus(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => viewProductDetails(item.id)}
                      role="button"
                      tabIndex={0}
                      className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
                    >
                      <div>
                        {/* Card Header: Category & Status Badge */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                            {item.category} {item.subcategory && `• ${item.subcategory}`}
                          </span>
                          {getStatusBadge(currentStatus)}
                        </div>

                        {/* Product Name & Brand */}
                        <h3 className="text-base font-extrabold text-neutral-900 leading-snug group-hover:text-red-700 transition-colors">
                          {item.name}
                        </h3>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5">
                          SKU: {item.sku} &bull; Model: {item.model}
                        </p>

                        {/* Specs */}
                        <p className="text-xs text-neutral-600 mt-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 leading-relaxed line-clamp-2">
                          {item.specs}
                        </p>
                      </div>

                      {/* Stock & Quick Adjust Buttons */}
                      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-neutral-400 font-medium block">Price</span>
                          <span className="text-base font-black text-neutral-900">
                            ETB {item.price.toLocaleString()}
                          </span>
                        </div>

                        {permissions.canManageStock ? (
                          <div
                            className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-xl border border-neutral-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => updateStock(item.id, -1)}
                              disabled={item.stockQuantity <= 0}
                              className="w-8 h-8 rounded-lg bg-white border border-neutral-200 font-black text-neutral-700 hover:bg-red-50 hover:text-red-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all text-sm"
                              aria-label={`Decrease stock of ${item.name}`}
                            >
                              -
                            </button>
                            <span className="text-xs font-black w-8 text-center text-neutral-900">
                              {item.stockQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateStock(item.id, 1)}
                              className="w-8 h-8 rounded-lg bg-white border border-neutral-200 font-black text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 flex items-center justify-center transition-all text-sm"
                              aria-label={`Increase stock of ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-neutral-600">{item.stockQuantity} units</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER: Minimal & Professional Hawassa-Ketema Branding */}
      {/* ------------------------------------------------------------------ */}
      <footer className="mt-auto border-t border-neutral-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="font-bold text-neutral-800">Hawassa-Ketema Computers</span>
            <span>&bull; Inventory Management Core</span>
          </div>
          <div>
            <span>Black, White, & Red visual style &bull; Mobile-first design</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
