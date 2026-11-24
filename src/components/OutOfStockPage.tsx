import React, { useMemo } from 'react';
import { useInventoryStore } from '../store/inventoryStore';
import { Product } from '../lib/inventory';

export default function OutOfStockPage() {
  const {
    products,
    transactions,
    viewProductDetails,
    setActiveView,
  } = useInventoryStore();

  // Filter every product with Quantity = 0 as required by Section 15
  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => p.stockQuantity <= 0);
  }, [products]);

  // Compute Last stock date and Last stock-out date for each product from transactions
  const getProductDates = (product: Product) => {
    // Find latest Stock In transaction for this product
    const stockInTx = transactions.find(
      (tx) => tx.productId === product.id && tx.action === 'Stock In'
    );
    // Find latest Stock Out transaction for this product
    const stockOutTx = transactions.find(
      (tx) => tx.productId === product.id && tx.action === 'Stock Out'
    );

    const lastStockDate =
      stockInTx?.timestamp ||
      product.dateAdded ||
      product.updatedAt ||
      'Initial Inventory';

    const lastStockOutDate =
      stockOutTx?.timestamp ||
      product.updatedAt ||
      'No stock-out recorded';

    return { lastStockDate, lastStockOutDate, stockOutReason: stockOutTx?.reason };
  };

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
            <span className="text-red-700">Out of Stock</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Out of Stock Items</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold border border-red-200">
              {outOfStockProducts.length} {outOfStockProducts.length === 1 ? 'Product' : 'Products'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Section 15: Critical inventory depleted to zero units requiring immediate supplier restocking.
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
      {outOfStockProducts.length === 0 ? (
        /* Empty State as required by Section 15 */
        <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200 space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            🎉
          </div>
          <h3 className="text-lg font-black text-neutral-900">
            🎉 No products are currently out of stock.
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            All registered Hawassa-Ketema computer models, accessories, and power solutions have active units available on shelves.
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
          {/* Alert Banner */}
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-center justify-between text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <span>
                <strong>{outOfStockProducts.length} hardware items</strong> have reached 0 units. Click any product below to inspect details or trigger a restock batch.
              </span>
            </div>
          </div>

          {/* Cards Grid (Mobile-First) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {outOfStockProducts.map((product) => {
              const { lastStockDate, lastStockOutDate, stockOutReason } = getProductDates(product);

              return (
                <div
                  key={product.id}
                  onClick={() => viewProductDetails(product.id)}
                  role="button"
                  tabIndex={0}
                  className="bg-white rounded-2xl p-5 border-2 border-red-200 hover:border-red-500 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between active:scale-[0.99] group space-y-4"
                >
                  <div>
                    {/* Header: Category & Spec-mandated Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        {product.category} {product.subcategory && `• ${product.subcategory}`}
                      </span>

                      {/* Section 15 requirement: Display: 🔴 OUT OF STOCK */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-50 text-red-700 border border-red-200 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                        🔴 OUT OF STOCK
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
                      <span className="font-semibold text-neutral-500 text-[11px]">
                        Min Threshold: {product.lowStockThreshold} units
                      </span>
                    </div>

                    {/* Section 15 Required Dates Box: Last stock date, Last stock-out date */}
                    <div className="mt-4 p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 font-medium flex items-center gap-1">
                          <span>📥</span> Last Stock Date:
                        </span>
                        <span className="font-mono font-bold text-neutral-800 text-[11px] truncate max-w-[150px]">
                          {lastStockDate}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60">
                        <span className="text-neutral-500 font-medium flex items-center gap-1">
                          <span>📤</span> Last Stock-Out Date:
                        </span>
                        <span className="font-mono font-bold text-red-700 text-[11px] truncate max-w-[150px]">
                          {lastStockOutDate}
                        </span>
                      </div>

                      {stockOutReason && (
                        <div className="text-[10px] text-neutral-500 italic pt-0.5">
                          Latest depletion reason: <strong>{stockOutReason}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-bold uppercase">
                        Current Units
                      </span>
                      <span className="text-xl font-black text-red-600">0 units</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        viewProductDetails(product.id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1 min-h-[38px]"
                    >
                      <span>+</span> Restock Item
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
