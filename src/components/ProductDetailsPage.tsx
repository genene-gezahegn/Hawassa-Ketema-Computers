import React, { useState } from 'react';
import { getRolePermissions, useInventoryStore } from '../store/inventoryStore';
import { getStockStatus, StockStatus, SerialNumberItem } from '../lib/inventory';
import ProductImage from './ProductImage';

export default function ProductDetailsPage() {
  const {
    products,
    currentUserRole,
    selectedProductId,
    currentUser,
    setActiveView,
    restockProduct,
  } = useInventoryStore();

  const product = products.find((p) => p.id === selectedProductId) || products[0];
  const permissions = getRolePermissions(currentUserRole);

  // Action Modals State
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [restockQty, setRestockQty] = useState<number>(1);
  const [restockReason, setRestockReason] = useState<string>('Purchase / Restock');
  const [restockSerialsText, setRestockSerialsText] = useState<string>('');
  const [restockNotes, setRestockNotes] = useState<string>('');
  const [copiedSku, setCopiedSku] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-neutral-800">Product Not Found</h2>
        <p className="text-xs text-neutral-500">The requested product could not be located in the inventory.</p>
        <button
          onClick={() => setActiveView('inventory')}
          className="px-4 py-2 bg-red-700 text-white rounded-xl text-xs font-bold min-h-[44px]"
        >
          Return to Inventory
        </button>
      </div>
    );
  }

  // Calculate status using required getStockStatus function
  const currentStatus: StockStatus = getStockStatus(product);

  // Financial calculations
  const buying = product.buyingPrice || product.price * 0.8;
  const selling = product.price;
  const marginPerUnit = selling - buying;
  const marginPercentage = buying > 0 ? ((marginPerUnit / buying) * 100).toFixed(1) : null;
  const totalBatchPotentialProfit = marginPerUnit * product.stockQuantity;

  // Determine if item typically carries serial numbers
  const isSerializedProduct =
    product.category === 'Laptop' ||
    product.category === 'Desktop' ||
    (product.serialNumbers && product.serialNumbers.length > 0) ||
    Boolean(product.serialNumber);

  // Status badge renderer
  const renderStatusBadge = (status: StockStatus) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            In Stock
          </span>
        );
      case 'low_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Low Stock
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 2000);
    } catch (e) {}
  };

  // Helper to auto-generate sample serial numbers for restock batch
  const handleAutoGenerateSerials = () => {
    const prefix = product.sku.replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const generated: string[] = [];
    for (let i = 1; i <= restockQty; i++) {
      const pad = String(i).padStart(2, '0');
      generated.push(`${prefix}-${datePart}-${pad}`);
    }
    setRestockSerialsText(generated.join('\n'));
  };

  // SECTION 10: Restocking Submit Handler
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockQty <= 0) return;

    // Parse serial numbers if provided
    const parsedSerials = restockSerialsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const oldStatus = currentStatus;
    const oldQty = product.stockQuantity;

    const ok = restockProduct({
      productId: product.id,
      quantity: restockQty,
      newSerialNumbers: parsedSerials,
      reason: restockReason,
      user: currentUser,
      notes: restockNotes.trim() || undefined,
    });

    if (ok) {
      const newQty = oldQty + restockQty;
      const newStatus = getStockStatus(newQty, product.lowStockThreshold);
      const statusChangedText =
        oldStatus === 'out_of_stock'
          ? ' • Automatically changed OUT OF STOCK → IN STOCK!'
          : '';

      setActionFeedback({
        message: `Successfully restocked ${restockQty} unit(s) of ${product.name}! Stock increased from ${oldQty} to ${newQty} units (${newStatus.replace('_', ' ')})${statusChangedText}`,
        type: 'success',
      });

      setIsRestockModalOpen(false);
      setRestockQty(1);
      setRestockSerialsText('');
      setRestockNotes('');
      setTimeout(() => setActionFeedback(null), 6000);
    }
  };

  // Section 7: Serial Numbers List
  const serialItems: SerialNumberItem[] =
    product.serialNumbers && product.serialNumbers.length > 0
      ? product.serialNumbers
      : product.serialNumber
      ? [{ serialNumber: product.serialNumber, status: 'In Stock', location: product.storageLocation }]
      : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb Navigation */}
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
            <button
              type="button"
              onClick={() => setActiveView('inventory')}
              className="hover:text-red-700 transition-colors"
            >
              All Inventory
            </button>
            <span>/</span>
            <span className="text-red-700 truncate max-w-xs">{product.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            {product.name}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Detailed hardware specifications, serial number tracking, pricing, and stock transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('inventory')}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 self-start sm:self-auto min-h-[44px]"
        >
          <span>←</span> Back to Inventory
        </button>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 animate-in fade-in shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              ✓
            </span>
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-emerald-700 font-bold hover:text-emerald-900 text-lg"
          >
            &times;
          </button>
        </div>
      )}

      {/* ================================================================== */}
      {/* ACTION BUTTONS BAR (Add Stock, Stock Out, Edit, View History) */}
      {/* ================================================================== */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Quick Actions:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Add Stock Button (SECTION 10 RESTOCKING) */}
          {permissions.canManageStock && <button
            type="button"
            onClick={() => setIsRestockModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
          >
            <span>+</span> Add Stock
          </button>}

          {/* Action 2: Stock Out Button (SECTION 8 STOCK OUT - Navigates to Section 8 workflow) */}
          {permissions.canManageStock && <button
            type="button"
            onClick={() => setActiveView('stock_out')}
            disabled={product.stockQuantity <= 0}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-extrabold text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
          >
            <span>📤</span> Stock Out
          </button>}

          {/* Action 3: Edit Button */}
          {permissions.canEditProduct && <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-extrabold text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
          >
            <span>✏️</span> Edit
          </button>}

          {/* Action 4: View History Button (SECTION 13) */}
          <button
            type="button"
            onClick={() => setActiveView('stock_history')}
            className="px-4 py-2.5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-extrabold text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
          >
            <span>🕒</span> View History
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 12: PRODUCT DETAILS CONTENT GRID */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Photo, Pricing & Stock Status */}
        <div className="space-y-6">
          {/* Product Photo Card */}
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
            <div className="w-full h-64 sm:h-72 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 relative group flex items-center justify-center">
              <ProductImage product={product} />

              {/* Condition Badge Overlay */}
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 rounded-full bg-neutral-900/90 text-white font-extrabold text-xs backdrop-blur-sm shadow">
                  {product.condition}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-medium">Category:</span>
              <span className="font-bold text-neutral-900">
                {product.category} {product.subcategory && `(${product.subcategory})`}
              </span>
            </div>
          </div>

          {/* Pricing & Margin Card */}
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Pricing & Potential Margin
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 font-bold block uppercase">Buying Price</span>
                <span className="text-base font-extrabold text-neutral-900">
                  ETB {buying.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-red-50/60 rounded-xl border border-red-100">
                <span className="text-[10px] text-red-600 font-bold block uppercase">Selling Price</span>
                <span className="text-base font-black text-red-700">
                  ETB {selling.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Potential Margin */}
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-800 font-medium">Potential Margin / Unit:</span>
                <span className="font-black text-emerald-700">
                  +ETB {marginPerUnit.toLocaleString()} {marginPercentage ? `(${marginPercentage}%)` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60">
                <span className="text-emerald-800 font-medium">Total Batch Potential Margin:</span>
                <span className="font-black text-emerald-800">
                  +ETB {totalBatchPotentialProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Current Stock & Threshold Card */}
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Stock Status
              </h3>
              {renderStatusBadge(currentStatus)}
            </div>

            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
              <div>
                <span className="text-[11px] text-neutral-400 block uppercase font-bold">Quantity on Hand</span>
                <span className="text-3xl font-black text-neutral-900">
                  {product.stockQuantity} <span className="text-xs font-bold text-neutral-500">units</span>
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-neutral-400 block uppercase font-bold">Minimum Stock Level</span>
                <span className="text-xl font-bold text-amber-700">
                  {product.lowStockThreshold} units
                </span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 leading-relaxed">
              When stock drops to or below <strong>{product.lowStockThreshold} units</strong>, the system triggers an automatic low stock warning.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Technical Specs, Serial Numbers, Supplier & Metadata */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & SKU Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                  {product.brand} &bull; {product.category}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-neutral-900 mt-0.5">
                  {product.name}
                </h2>
                <p className="text-xs font-semibold text-neutral-500 mt-0.5">
                  Model: <span className="text-neutral-800 font-bold">{product.model}</span>
                </p>
              </div>

              {/* Product Code (SKU) with Copy Button */}
              <div className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Product Code</span>
                  <span className="font-mono text-xs font-black text-neutral-900">{product.sku}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(product.sku)}
                  className="p-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-xs font-bold active:scale-95 transition-all min-h-[36px]"
                  title="Copy Product Code"
                >
                  {copiedSku ? '✓' : '📋'}
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* SECTION 7: SERIAL NUMBER TRACKING */}
          {/* ================================================================ */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏷️</span>
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900">
                    Serial Number Tracking
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Track individual device hardware serial numbers and status.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700">
                {serialItems.length} {serialItems.length === 1 ? 'Serial Logged' : 'Serials Logged'}
              </span>
            </div>

            {serialItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-100">
                No individual serial numbers tracked for this item yet. (Non-serialized accessory or bulk item).
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                {serialItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="py-3 px-2 flex items-center justify-between hover:bg-neutral-50 rounded-xl transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-neutral-400 font-mono text-[11px]">#{idx + 1}</span>
                      <div>
                        {/* Section 7 format: Serial Number: ABC123 — In Stock */}
                        <span className="font-mono font-bold text-neutral-900">
                          Serial Number: {item.serialNumber}
                        </span>
                        {item.location && (
                          <span className="text-[11px] text-neutral-400 block mt-0.5">
                            📍 {item.location} {item.dateLogged ? `• Logged: ${item.dateLogged}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {item.status === 'In Stock' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          In Stock
                        </span>
                      ) : item.status === 'Sold' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          Sold
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Reserved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Specifications Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Technical Specifications
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {product.cpu && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">CPU</span>
                  <span className="font-extrabold text-neutral-900">{product.cpu}</span>
                </div>
              )}
              {product.ram && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">RAM</span>
                  <span className="font-extrabold text-neutral-900">{product.ram}</span>
                </div>
              )}
              {product.ssd && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">SSD</span>
                  <span className="font-extrabold text-neutral-900">{product.ssd}</span>
                </div>
              )}
              {product.hdd && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">HDD</span>
                  <span className="font-extrabold text-neutral-900">{product.hdd}</span>
                </div>
              )}
              {product.gpu && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">GPU</span>
                  <span className="font-extrabold text-neutral-900">{product.gpu}</span>
                </div>
              )}
              {product.screenSize && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">Screen Size</span>
                  <span className="font-extrabold text-neutral-900">{product.screenSize}</span>
                </div>
              )}
              {product.capacity && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">Capacity</span>
                  <span className="font-extrabold text-neutral-900">{product.capacity}</span>
                </div>
              )}
              {product.voltage && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">Voltage</span>
                  <span className="font-extrabold text-neutral-900">{product.voltage}</span>
                </div>
              )}
              {product.powerRating && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">Power Rating</span>
                  <span className="font-extrabold text-neutral-900">{product.powerRating}</span>
                </div>
              )}
              {product.connectivity && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">Connectivity</span>
                  <span className="font-extrabold text-neutral-900">{product.connectivity}</span>
                </div>
              )}
              {product.compatibility && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">Compatibility</span>
                  <span className="font-extrabold text-neutral-900">{product.compatibility}</span>
                </div>
              )}
            </div>

            {product.specs && (
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs text-neutral-700">
                <span className="font-bold text-neutral-900 block mb-0.5">Configuration Summary:</span>
                {product.specs}
              </div>
            )}
          </div>

          {/* Supplier, Storage Location & Date Added Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Logistics & Supplier Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 block font-bold uppercase">Supplier</span>
                <span className="font-bold text-neutral-900">{product.supplier || 'Hawassa Local Partner'}</span>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 block font-bold uppercase">Storage Location</span>
                <span className="font-bold text-neutral-900">📍 {product.storageLocation || 'Main Showroom'}</span>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <span className="text-[10px] text-neutral-400 block font-bold uppercase">Date Added</span>
                <span className="font-bold text-neutral-900">{product.dateAdded || product.updatedAt || 'Recent'}</span>
              </div>
            </div>

            {/* Notes */}
            {product.notes && (
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs">
                <span className="font-bold text-neutral-900 block mb-1">Internal Notes:</span>
                <p className="text-neutral-600 leading-relaxed">{product.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 10: RESTOCKING MODAL */}
      {/* Asks for quantity to add, new serial numbers (if applicable), */}
      {/* updates store quantity, and automatically changes OUT OF STOCK -> IN STOCK */}
      {/* ================================================================== */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsRestockModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-base">
                  +
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900">Restock Product &bull; Section 10</h3>
                  <p className="text-xs text-neutral-500">Add inventory units and register new serial numbers</p>
                </div>
              </div>
              <button
                onClick={() => setIsRestockModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Product Status & Snapshot */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900">{product.name}</span>
                <span className="font-mono text-neutral-500">{product.sku}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-200/60">
                <span>
                  Current Stock: <strong>{product.stockQuantity} units</strong>
                </span>
                <span>
                  Status: <strong>{currentStatus.replace('_', ' ').toUpperCase()}</strong>
                </span>
              </div>
              {product.stockQuantity === 0 && (
                <p className="text-[11px] text-emerald-700 font-bold pt-1">
                  💡 Restocking will automatically transition this product from OUT OF STOCK to IN STOCK!
                </p>
              )}
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              {/* 1. Quantity to Add */}
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Quantity to Add: <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 font-black text-sm text-neutral-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  New stock quantity will be: <strong>{product.stockQuantity + restockQty} units</strong>
                </p>
              </div>

              {/* 2. New Serial Numbers (If Applicable) */}
              {isSerializedProduct && (
                <div className="space-y-2 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-bold text-neutral-800 uppercase tracking-wider">
                        New Serial Numbers (Applicable)
                      </label>
                      <p className="text-[11px] text-neutral-500">
                        Enter {restockQty} hardware serial number(s), separated by commas or line breaks.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoGenerateSerials}
                      className="px-2.5 py-1 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-[11px] font-bold shadow-sm"
                    >
                      ⚡ Auto-Generate ({restockQty})
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    placeholder={`e.g.\n${product.sku.replace(/[^A-Z0-9]/g, '')}-001\n${product.sku.replace(/[^A-Z0-9]/g, '')}-002`}
                    value={restockSerialsText}
                    onChange={(e) => setRestockSerialsText(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              )}

              {/* 3. Reason */}
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Restock Reason / Source:
                </label>
                <select
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="Purchase / Restock">📦 Purchase / Supplier Shipment</option>
                  <option value="Returned from Customer">↩️ Returned from Customer</option>
                  <option value="Transferred from Branch">🔄 Transferred from Other Branch</option>
                  <option value="Inventory Adjustment">📝 Inventory Count Adjustment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* 4. Notes */}
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Notes & Details:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Purchase order #892 from Addis IT Imports, batch arrival"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow active:scale-95 transition-all min-h-[44px]"
                >
                  Confirm Restock (+{restockQty} Units)
                </button>
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: EDIT PRODUCT DETAILS */}
      {/* ================================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsEditModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-base font-extrabold text-neutral-900">✏️ Product Editor</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Viewing details for <strong>{product.name}</strong> (SKU: {product.sku}).
              To update stock quantities and maintain transaction audit history, use the dedicated <strong>Add Stock</strong> and <strong>Stock Out</strong> actions.
            </p>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1">
              <div>
                <span className="text-neutral-400 font-bold">Storage Location:</span>{' '}
                <strong className="text-neutral-800">{product.storageLocation || 'Main Showroom'}</strong>
              </div>
              <div>
                <span className="text-neutral-400 font-bold">Supplier:</span>{' '}
                <strong className="text-neutral-800">{product.supplier || 'Hawassa Local Partner'}</strong>
              </div>
              <div>
                <span className="text-neutral-400 font-bold">Threshold Alert:</span>{' '}
                <strong className="text-neutral-800">{product.lowStockThreshold} units</strong>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
