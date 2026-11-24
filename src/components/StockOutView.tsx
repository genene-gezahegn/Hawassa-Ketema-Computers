import React, { useState, useEffect } from 'react';
import { useInventoryStore, StockOutReason } from '../store/inventoryStore';

export default function StockOutView() {
  const {
    products,
    selectedProductId,
    currentUser,
    stockOutProduct,
    setActiveView,
    viewProductDetails,
  } = useInventoryStore();

  // Selected product (defaults to selectedProductId or first in-stock product)
  const [productId, setProductId] = useState<string>(() => {
    if (selectedProductId) return selectedProductId;
    const inStock = products.find((p) => p.stockQuantity > 0);
    return inStock ? inStock.id : products[0]?.id || '';
  });

  // Keep productId in sync if selectedProductId changes in the store
  useEffect(() => {
    if (selectedProductId && products.some((p) => p.id === selectedProductId)) {
      setProductId(selectedProductId);
    }
  }, [selectedProductId, products]);

  const selectedProduct = products.find((p) => p.id === productId);

  // Form Fields as required by Section 8
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([]);
  const [reason, setReason] = useState<StockOutReason>('Sold');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  // Confirmation Prompt Modal State (Section 8: "Are you sure you want to remove 2 units?")
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Filter in-stock serial numbers for the selected product
  const availableSerials = (selectedProduct?.serialNumbers || []).filter(
    (s) => s.status === 'In Stock'
  );

  // Reset selected serials when product changes
  useEffect(() => {
    setSelectedSerialNumbers([]);
    setQuantity(1);
    setErrorMessage('');
    setSuccessMessage('');
  }, [productId]);

  // Handle toggling a serial number
  const toggleSerialNumber = (sn: string) => {
    if (selectedSerialNumbers.includes(sn)) {
      const next = selectedSerialNumbers.filter((item) => item !== sn);
      setSelectedSerialNumbers(next);
      setQuantity(Math.max(1, next.length));
    } else {
      const next = [...selectedSerialNumbers, sn];
      setSelectedSerialNumbers(next);
      setQuantity(next.length);
    }
  };

  // Pre-validate before showing the confirmation prompt
  const handleInitiateStockOut = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedProduct) {
      setErrorMessage('Please select a valid product.');
      return;
    }
    if (quantity <= 0 || isNaN(quantity)) {
      setErrorMessage('Quantity must be at least 1 unit.');
      return;
    }
    if (selectedProduct.stockQuantity < quantity) {
      setErrorMessage(
        `Insufficient stock! Only ${selectedProduct.stockQuantity} unit(s) available for ${selectedProduct.name}.`
      );
      return;
    }
    if (availableSerials.length > 0 && selectedSerialNumbers.length > 0 && selectedSerialNumbers.length !== quantity) {
      setErrorMessage(
        `Selected serial numbers (${selectedSerialNumbers.length}) must match the quantity to remove (${quantity}).`
      );
      return;
    }

    // Show the confirmation prompt modal required by Section 8
    setShowConfirmModal(true);
  };

  // Section 8: Execute Stock Out upon confirmation
  const handleConfirmStockOut = () => {
    if (!selectedProduct) return;

    const ok = stockOutProduct({
      productId: selectedProduct.id,
      quantity,
      selectedSerialNumbers,
      reason,
      user: currentUser,
      notes: notes.trim(),
      date,
    });

    setShowConfirmModal(false);

    if (ok) {
      setSuccessMessage(
        `Successfully removed ${quantity} unit(s) of ${selectedProduct.name} (${reason}). New stock is ${
          selectedProduct.stockQuantity - quantity
        } unit(s).`
      );
      setQuantity(1);
      setSelectedSerialNumbers([]);
      setNotes('');
    } else {
      setErrorMessage('Failed to process Stock Out transaction.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200/80 pb-4">
        <div>
          <span className="text-xs font-bold text-red-700 uppercase tracking-widest">
            Inventory Transactions &bull; Section 8
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Stock Out / Removal
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Deduct inventory with reason logging and serial number tracking. Products are never permanently deleted.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {selectedProductId && (
            <button
              type="button"
              onClick={() => viewProductDetails(selectedProductId)}
              className="text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-3.5 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px]"
            >
              ← Product Details
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className="text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px]"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-5 shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow">
                ✓
              </span>
              <div>
                <h4 className="font-extrabold text-emerald-950 text-sm">
                  Stock Out Transaction Recorded!
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">{successMessage}</p>
              </div>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-lg"
            >
              &times;
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-emerald-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveView('stock_history')}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-all shadow min-h-[38px]"
            >
              View Stock History →
            </button>
            {selectedProduct && (
              <button
                type="button"
                onClick={() => viewProductDetails(selectedProduct.id)}
                className="px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-50 transition-all min-h-[38px]"
              >
                View Product Details
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-2xl bg-red-50 border border-red-300 p-4 text-red-800 flex items-center justify-between text-xs font-bold animate-in fade-in">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-red-700 font-bold text-lg">
            &times;
          </button>
        </div>
      )}

      {/* Main Stock Out Form */}
      <form onSubmit={handleInitiateStockOut} className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-5">
        {/* 1. Product Selection */}
        <div>
          <label htmlFor="select-product" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            1. Product Selection <span className="text-red-600">*</span>
          </label>
          <select
            id="select-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-sm font-semibold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
          >
            {products.map((p) => {
              const emoji =
                p.category === 'Laptop'
                  ? '💻'
                  : p.category === 'Desktop'
                  ? '🖥️'
                  : p.category === 'Power Solutions'
                  ? '⚡'
                  : '🔧';
              return (
                <option key={p.id} value={p.id} disabled={p.stockQuantity <= 0}>
                  {emoji} {p.name} ({p.brand}) — Available: {p.stockQuantity}{' '}
                  {p.stockQuantity === 0 ? '(OUT OF STOCK)' : 'units'}
                </option>
              );
            })}
          </select>
        </div>

        {/* Selected Product Snapshot Card */}
        {selectedProduct && (
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {selectedProduct.category} &bull; {selectedProduct.brand} &bull; SKU: {selectedProduct.sku}
              </span>
              <h4 className="font-extrabold text-neutral-900 text-sm mt-0.5">{selectedProduct.name}</h4>
              <p className="text-neutral-500 font-mono mt-0.5">
                Location: {selectedProduct.storageLocation || 'Main Showroom'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-neutral-400 block font-bold uppercase">Current Stock</span>
                <span
                  className={`text-2xl font-black ${
                    selectedProduct.stockQuantity === 0
                      ? 'text-red-600'
                      : selectedProduct.stockQuantity <= selectedProduct.lowStockThreshold
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {selectedProduct.stockQuantity} <span className="text-xs font-bold text-neutral-500">units</span>
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 2. Quantity */}
          <div>
            <label htmlFor="stockout-qty" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              2. Quantity to Remove <span className="text-red-600">*</span>
            </label>
            <input
              id="stockout-qty"
              type="number"
              min="1"
              max={selectedProduct ? selectedProduct.stockQuantity : 100}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 font-black text-neutral-900 text-base focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
            />
            {selectedProduct && selectedProduct.stockQuantity > 0 && (
              <p className="text-[11px] text-neutral-500 mt-1">
                Remaining after stock out: <strong>{Math.max(0, selectedProduct.stockQuantity - quantity)} units</strong>
              </p>
            )}
          </div>

          {/* 3. Reason (Sold, Damaged, Returned, Transferred, Other) */}
          <div>
            <label htmlFor="stockout-reason" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              3. Reason <span className="text-red-600">*</span>
            </label>
            <select
              id="stockout-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as StockOutReason)}
              className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-sm font-bold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
            >
              <option value="Sold">💰 Sold</option>
              <option value="Damaged">💥 Damaged</option>
              <option value="Returned">↩️ Returned</option>
              <option value="Transferred">🔄 Transferred</option>
              <option value="Other">📝 Other</option>
            </select>
          </div>
        </div>

        {/* 4. Serial Number Selection (if applicable) */}
        {availableSerials.length > 0 && (
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  4. Serial Number Selection (Applicable)
                </label>
                <p className="text-[11px] text-neutral-500">
                  Select the specific hardware serial numbers being removed ({selectedSerialNumbers.length} of {quantity} selected).
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">
                {availableSerials.length} in stock
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pt-1">
              {availableSerials.map((s) => {
                const isSelected = selectedSerialNumbers.includes(s.serialNumber);
                return (
                  <button
                    key={s.serialNumber}
                    type="button"
                    onClick={() => toggleSerialNumber(s.serialNumber)}
                    className={`p-2.5 rounded-xl border text-xs font-mono text-left flex items-center justify-between transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow'
                        : 'bg-white text-neutral-800 border-neutral-200 hover:border-red-400'
                    }`}
                  >
                    <span className="font-bold truncate">{s.serialNumber}</span>
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isSelected ? 'bg-red-600 text-white' : 'border border-neutral-300'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 5. Date */}
          <div>
            <label htmlFor="stockout-date" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              5. Date <span className="text-red-600">*</span>
            </label>
            <input
              id="stockout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-neutral-900 text-sm font-semibold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
            />
          </div>

          {/* User Tracking */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Authorized User
            </label>
            <input
              type="text"
              value={currentUser}
              disabled
              className="w-full px-3.5 py-3 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-600 text-sm font-bold min-h-[48px]"
            />
          </div>
        </div>

        {/* 6. Notes */}
        <div>
          <label htmlFor="stockout-notes" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            6. Notes & Comments
          </label>
          <textarea
            id="stockout-notes"
            rows={3}
            placeholder="Recipient customer name, invoice number, branch destination, or condition write-off notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none"
          />
        </div>

        {/* Submit Button (Triggers Section 8 confirmation prompt) */}
        <button
          type="submit"
          disabled={!selectedProduct || selectedProduct.stockQuantity <= 0}
          className="w-full py-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-extrabold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all min-h-[50px] flex items-center justify-center gap-2"
        >
          <span>📤</span> Process Stock Out
        </button>
      </form>

      {/* ================================================================== */}
      {/* SECTION 8: CONFIRMATION PROMPT MODAL */}
      {/* Before confirming, show a prompt: "Are you sure you want to remove 2 units?" */}
      {/* ================================================================== */}
      {showConfirmModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-neutral-100">
              <span className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center text-xl font-black">
                ⚠️
              </span>
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">
                  Confirm Stock Removal
                </h3>
                <p className="text-xs text-neutral-500">Hawassa-Ketema Inventory Safety Check</p>
              </div>
            </div>

            {/* Required exact prompt question */}
            <p className="text-sm font-extrabold text-neutral-900 leading-snug">
              Are you sure you want to remove {quantity} {quantity === 1 ? 'unit' : 'units'}?
            </p>

            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1">
              <p>
                <span className="text-neutral-500 font-medium">Product:</span>{' '}
                <strong className="text-neutral-900">{selectedProduct.name}</strong>
              </p>
              <p>
                <span className="text-neutral-500 font-medium">Reason:</span>{' '}
                <strong className="text-neutral-900">{reason}</strong>
              </p>
              <p>
                <span className="text-neutral-500 font-medium">Current Stock:</span>{' '}
                <span className="font-bold text-neutral-800">{selectedProduct.stockQuantity} units</span> →{' '}
                <span className="font-bold text-red-700">
                  New: {selectedProduct.stockQuantity - quantity} units
                </span>
              </p>
              {selectedSerialNumbers.length > 0 && (
                <p className="pt-1 text-[11px] text-neutral-600 font-mono">
                  Serials: {selectedSerialNumbers.join(', ')}
                </p>
              )}
            </div>

            <p className="text-[11px] text-neutral-500">
              This will create a permanent Stock Out record in the Stock History log and update the live dashboard counters.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmStockOut}
                className="flex-1 py-3 px-4 rounded-xl bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs shadow active:scale-95 transition-all min-h-[44px]"
              >
                Yes, Remove {quantity} {quantity === 1 ? 'Unit' : 'Units'}
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
