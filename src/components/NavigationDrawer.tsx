import React from 'react';
import { getRolePermissions, useInventoryStore, ActiveView } from '../store/inventoryStore';
import { getDashboardCounts } from '../lib/inventory';

export default function NavigationDrawer() {
  const {
    isMenuOpen,
    activeView,
    products,
    currentUserRole,
    selectedStatus,
    setMenuOpen,
    setActiveView,
    setSelectedStatus,
    setSelectedCategory,
    resetFilters,
  } = useInventoryStore();

  if (!isMenuOpen) return null;

  const counts = getDashboardCounts(products);
  const permissions = getRolePermissions(currentUserRole);

  // Section 3: Exact 9 items required by master spec
  const menuItems: Array<{
    id: ActiveView;
    number: number;
    title: string;
    icon: string;
    badge?: number;
    badgeColor?: string;
    onClick: () => void;
    isActive: boolean;
  }> = [
    {
      id: 'dashboard',
      number: 1,
      title: 'Dashboard',
      icon: '📊',
      onClick: () => {
        resetFilters();
        setActiveView('dashboard');
      },
      isActive: activeView === 'dashboard',
    },
    {
      id: 'inventory',
      number: 2,
      title: 'Inventory',
      icon: '📦',
      badge: counts.totalProducts,
      badgeColor: 'bg-neutral-800 text-white',
      onClick: () => {
        setSelectedStatus('all');
        setSelectedCategory(null);
        setActiveView('inventory');
      },
      isActive: activeView === 'inventory' && selectedStatus === 'all',
    },
    {
      id: 'add_item',
      number: 3,
      title: 'Add Item',
      icon: '➕',
      badgeColor: 'bg-red-600 text-white',
      onClick: () => {
        setActiveView('add_item');
      },
      isActive: activeView === 'add_item',
    },
    {
      id: 'stock_out',
      number: 4,
      title: 'Stock Out',
      icon: '📤',
      onClick: () => {
        setActiveView('stock_out');
      },
      isActive: activeView === 'stock_out',
    },
    {
      id: 'out_of_stock',
      number: 5,
      title: 'Out of Stock',
      icon: '🛑',
      badge: counts.outOfStock,
      badgeColor: 'bg-red-600 text-white',
      onClick: () => {
        setActiveView('out_of_stock');
      },
      isActive: activeView === 'out_of_stock',
    },
    {
      id: 'low_stock',
      number: 6,
      title: 'Low Stock',
      icon: '⚠️',
      badge: counts.lowStock,
      badgeColor: 'bg-amber-600 text-white',
      onClick: () => {
        setActiveView('low_stock');
      },
      isActive: activeView === 'low_stock',
    },
    {
      id: 'reports',
      number: 7,
      title: 'Reports',
      icon: '📈',
      onClick: () => {
        setActiveView('reports');
      },
      isActive: activeView === 'reports',
    },
    {
      id: 'stock_history',
      number: 8,
      title: 'Stock History',
      icon: '🕒',
      onClick: () => {
        setActiveView('stock_history');
      },
      isActive: activeView === 'stock_history',
    },
    {
      id: 'settings',
      number: 9,
      title: 'Settings',
      icon: '⚙️',
      onClick: () => {
        setActiveView('settings');
      },
      isActive: activeView === 'settings',
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.id === 'add_item') return permissions.canAddProduct;
    if (item.id === 'stock_out') return permissions.canManageStock;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dimmed Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out Drawer Panel on Mobile & Desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className="relative w-4/5 max-w-sm bg-white text-neutral-900 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-200"
      >
        {/* Red Brand Drawer Header */}
        <div className="bg-red-700 text-white p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-red-700 flex items-center justify-center font-black shadow text-lg">
              HK
            </div>
            <div>
              <h2 className="font-extrabold text-base leading-tight tracking-tight">
                Hawassa-Ketema
              </h2>
              <p className="text-xs text-red-200 font-medium">Computers Inventory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="p-2 rounded-xl hover:bg-red-800 text-white min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 transition-all"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Clean, Easy-to-Navigate Menu Items (1 to 9 as specified in Section 3) */}
        <nav className="p-3 sm:p-4 flex-1 overflow-y-auto space-y-1">
          <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-3 pt-2 pb-1.5">
            Main Menu
          </div>

          {visibleMenuItems.map((item, index) => {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl font-bold transition-all text-left min-h-[48px] select-none active:scale-[0.98] ${
                  item.isActive
                    ? 'bg-neutral-900 text-white shadow-md'
                    : 'text-neutral-700 hover:bg-red-50 hover:text-red-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center">{item.icon}</span>
                  <span className="text-sm">
                    {index + 1}. {item.title}
                  </span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      item.isActive ? 'bg-white text-neutral-900' : item.badgeColor || 'bg-neutral-200 text-neutral-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick Barcode Scanner Action */}
          <div className="pt-3 px-1 border-t border-neutral-100 mt-2">
            <button
              type="button"
              onClick={() => {
                setActiveView('scan');
                setMenuOpen(false);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-xs flex items-center justify-center gap-2 border border-red-200 transition-colors min-h-[44px]"
            >
              <span>📷</span> Scan Barcode / QR Code
            </button>
          </div>
        </nav>

        {/* Drawer Footer Information */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 text-xs text-neutral-500 space-y-2">
          <div className="flex items-center justify-between font-bold text-neutral-700">
            <span>Hawassa-Ketema Computers</span>
            <span className="text-emerald-700">v1.2.0</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Professional Black, White, & Red inventory system &bull; Mobile-First
          </p>
        </div>
      </div>
    </div>
  );
}
