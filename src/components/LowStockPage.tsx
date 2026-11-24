import React, { useMemo } from 'react';
import { useInventoryStore } from '../store/inventoryStore';
import { Product } from '../lib/inventory';

export default function LowStockPage() {
  const { products, viewProductDetails, setActiveView } = useInventoryStore();

  // Filter products: Quantity > 0 AND Quantity <= Minimum Stock Level (Section 16)
  // Sort the most urgent low-stock items first (largest difference between minStockLevel and quantity)
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold)
      .sort((a, b) => {
        const diffA = a.lowStockThreshold - a.stockQuantity;
        const diffB = b.lowStockThreshold - b.stockQuantity;
        if (diffB !== diffA) {
          return diffB - diffA; // largest deficit first
        }
        return a.stockQuantity - b.stockQuantity; // lower remaining quantity first
      });
  }, [products]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-1">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="hover:text-red-700 transition-colors"
            >
              Dashboard
            </button>
            <span>/</span>
            <span className="text-amber-700">Low Stock</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Low Stock Reorder Alerts</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
              {lowStockProducts.length} {lowStockProducts.length === 1 ? 'Product' : 'Products'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Section 16: Products below their safety threshold. Sorted strictly by highest replenishment urgency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('inventory')}
            className="text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px]"
          >
            📦 All Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className="text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px]"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {lowStockProducts.length === 0 ? (
        /* Empty State as required by Section 16 */
        <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200 space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            🎉
          </div>
          <h3 className="text-lg font-black text-neutral-900">
            🎉 No products are currently low stock.
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            All inventory products are sufficiently stocked above their designated minimum threshold buffers.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveView('inventory')}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs shadow-sm"
            >
              Browse All Inventory
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Urgency Explanation Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-center justify-between text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <span>
                <strong>Urgent Priority Queue:</strong> Products with the widest gap between minimum buffer and on-hand stock appear at the top.
              </span>
            </div>
          </div>

          {/* Low Stock Items Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockProducts.map((product, idx) => {
              const deficit = product.lowStockThreshold - product.stockQuantity;
              const ratio = Math.round((product.stockQuantity / product.lowStockThreshold) * 100);

              return (
                <div
                  key={product.id}
                  onClick={() => viewProductDetails(product.id)}
                  role="button"
                  tabIndex={0}
                  className="bg-white rounded-2xl p-5 border-2 border-amber-300 hover:border-amber-500 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between active:scale-[0.99] group space-y-4"
                >
                  <div>
                    {/* Header: Urgency Rank & Section 16 Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[10px] font-black flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                          {product.category}
                        </span>
                      </div>

                      {/* Section 16 Requirement: Display: 🟠 LOW STOCK */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                        🟠 LOW STOCK
                      </span>
                    </div>

                    {/* Product Name, Brand, Model */}
                    <h3 className="text-base font-black text-neutral-900 group-hover:text-red-700 transition-colors leading-snug">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-neutral-600 mt-1">
                      <span className="font-bold text-neutral-800">{product.brand}</span>
                      <span>&bull;</span>
                      <span>Model: {product.model}</span>
                    </div>

                    {/* SKU badge */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        SKU: {product.sku}
                      </span>
                      <span className="text-[11px] font-bold text-neutral-600">
                        Location: {product.storageLocation || 'Main Showroom'}
                      </span>
                    </div>

                    {/* Urgency & Buffer Metrics */}
                    <div className="mt-4 p-3.5 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                            On-Hand Quantity
                          </span>
                          <span className="text-2xl font-black text-amber-700">
                            {product.stockQuantity}{' '}
                            <span className="text-xs font-bold text-neutral-500">units</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                            Min Buffer Level
                          </span>
                          <span className="text-lg font-extrabold text-neutral-800">
                            {product.lowStockThreshold} units
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar Showing Buffer Fill Ratio */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500 mb-1">
                          <span>Threshold Deficit:</span>
                          <span className="text-red-600 font-black">
                            {deficit > 0 ? `-${deficit} units below min` : 'At threshold'}
                          </span>
                        </div>
                        <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(10, ratio))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-xs text-neutral-500">
                      Supplier: <strong className="text-neutral-800">{product.supplier || 'Hawassa Partner'}</strong>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        viewProductDetails(product.id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1 min-h-[38px]"
                    >
                      <span>+</span> Add Stock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
