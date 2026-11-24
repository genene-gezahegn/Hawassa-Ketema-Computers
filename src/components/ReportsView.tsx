import React, { useState, useMemo } from 'react';
import { useInventoryStore } from '../store/inventoryStore';
import { getStockStatus, getInventoryValue, Category } from '../lib/inventory';

type ReportTab = 'inventory' | 'stock_out' | 'low_stock' | 'valuation';

// Client-side RFC 4180 compliant CSV export generator
function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportsView() {
  const { products, transactions, setActiveView, viewProductDetails } = useInventoryStore();

  const [activeTab, setActiveTab] = useState<ReportTab>('inventory');
  const [searchFilter, setSearchFilter] = useState('');

  // --------------------------------------------------------------------------
  // TAB 1 DATA: INVENTORY REPORT
  // Show Product, Category, Quantity, Status, Condition, Value
  // --------------------------------------------------------------------------
  const inventoryReportData = useMemo(() => {
    return products.filter((p) => {
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchFilter]);

  // --------------------------------------------------------------------------
  // TAB 2 DATA: STOCK-OUT REPORT
  // Show Product, Quantity removed, Reason, Date, User
  // --------------------------------------------------------------------------
  const stockOutReportData = useMemo(() => {
    return transactions
      .filter((tx) => tx.action === 'Stock Out')
      .filter((tx) => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return (
          tx.productName.toLowerCase().includes(q) ||
          tx.sku.toLowerCase().includes(q) ||
          tx.reason.toLowerCase().includes(q) ||
          tx.user.toLowerCase().includes(q) ||
          (tx.notes && tx.notes.toLowerCase().includes(q))
        );
      });
  }, [transactions, searchFilter]);

  // --------------------------------------------------------------------------
  // TAB 3 DATA: LOW STOCK REPORT
  // Show products below minimum stock
  // --------------------------------------------------------------------------
  const lowStockReportData = useMemo(() => {
    return products
      .filter((p) => p.stockQuantity <= p.lowStockThreshold)
      .sort((a, b) => {
        const diffA = a.lowStockThreshold - a.stockQuantity;
        const diffB = b.lowStockThreshold - b.stockQuantity;
        return diffB - diffA;
      })
      .filter((p) => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        );
      });
  }, [products, searchFilter]);

  // --------------------------------------------------------------------------
  // TAB 4 DATA: INVENTORY VALUE (via getInventoryValue)
  // Total Buying Value (Quantity × Buying Price)
  // Potential Sales Value (Quantity × Selling Price)
  // Potential Margin (Potential Sales Value - Total Buying Value)
  // CRITICAL REQUIREMENT: Label it clearly as "Potential Margin", NEVER "Profit".
  // --------------------------------------------------------------------------
  const {
    totalBuyingValue,
    totalSalesValue,
    potentialMargin,
    potentialMarginPercentage: potentialMarginRatio,
  } = useMemo(() => getInventoryValue(products), [products]);

  // Category breakdown for valuation
  const categoriesList: Category[] = ['Laptop', 'Desktop', 'Power Solutions', 'Accessories'];
  const categoryValuations = useMemo(() => {
    return categoriesList.map((cat) => {
      const catProducts = products.filter((p) => p.category === cat);
      const units = catProducts.reduce((sum, p) => sum + p.stockQuantity, 0);
      const buyingVal = catProducts.reduce(
        (sum, p) => sum + p.stockQuantity * (p.buyingPrice ?? p.price * 0.8),
        0
      );
      const salesVal = catProducts.reduce(
        (sum, p) => sum + p.stockQuantity * (p.sellingPrice ?? p.price),
        0
      );
      const margin = salesVal - buyingVal;
      return {
        category: cat,
        itemsCount: catProducts.length,
        totalUnits: units,
        buyingVal,
        salesVal,
        margin,
      };
    });
  }, [products]);

  // --------------------------------------------------------------------------
  // CSV EXPORT HANDLER
  // --------------------------------------------------------------------------
  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split('T')[0];

    switch (activeTab) {
      case 'inventory': {
        const headers = [
          'Product Name',
          'SKU',
          'Brand',
          'Model',
          'Category',
          'Quantity',
          'Status',
          'Condition',
          'Buying Price (ETB)',
          'Selling Price (ETB)',
          'Total Retail Value (ETB)',
        ];
        const rows = inventoryReportData.map((p) => [
          p.name,
          p.sku,
          p.brand,
          p.model,
          p.category,
          p.stockQuantity,
          getStockStatus(p).replace('_', ' ').toUpperCase(),
          p.condition,
          p.buyingPrice ?? (p.price * 0.8),
          p.sellingPrice ?? p.price,
          p.stockQuantity * (p.sellingPrice ?? p.price),
        ]);
        exportToCSV(`Hawassa_Inventory_Report_${dateStr}`, headers, rows);
        break;
      }
      case 'stock_out': {
        const headers = [
          'Product Name',
          'SKU',
          'Quantity Removed',
          'Reason',
          'Date and Time',
          'Authorized User',
          'Notes',
          'Serial Numbers',
        ];
        const rows = stockOutReportData.map((tx) => [
          tx.productName,
          tx.sku,
          Math.abs(tx.quantityChange),
          tx.reason,
          tx.timestamp,
          tx.user,
          tx.notes || '',
          tx.serialNumbers ? tx.serialNumbers.join('; ') : '',
        ]);
        exportToCSV(`Hawassa_StockOut_Report_${dateStr}`, headers, rows);
        break;
      }
      case 'low_stock': {
        const headers = [
          'Product Name',
          'SKU',
          'Category',
          'Quantity On Hand',
          'Minimum Stock Level',
          'Deficit Below Minimum',
          'Status',
          'Supplier',
        ];
        const rows = lowStockReportData.map((p) => [
          p.name,
          p.sku,
          p.category,
          p.stockQuantity,
          p.lowStockThreshold,
          Math.max(0, p.lowStockThreshold - p.stockQuantity),
          p.stockQuantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
          p.supplier || 'Hawassa Partner',
        ]);
        exportToCSV(`Hawassa_LowStock_Report_${dateStr}`, headers, rows);
        break;
      }
      case 'valuation': {
        const headers = [
          'Hardware Category',
          'Registered Products',
          'Total Units On Hand',
          'Total Buying Value (ETB)',
          'Potential Sales Value (ETB)',
          'Potential Margin (ETB)',
        ];
        const rows: (string | number)[][] = categoryValuations.map((c) => [
          c.category,
          c.itemsCount,
          c.totalUnits,
          c.buyingVal,
          c.salesVal,
          c.margin,
        ]);
        // Add grand total row
        rows.push([
          'GRAND TOTAL',
          products.length,
          products.reduce((s, p) => s + p.stockQuantity, 0),
          totalBuyingValue,
          totalSalesValue,
          potentialMargin,
        ]);
        exportToCSV(`Hawassa_Inventory_Valuation_${dateStr}`, headers, rows);
        break;
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Page Header */}
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
            <span className="text-red-700">Reports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Executive Inventory Reports</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Section 17: Comprehensive business intelligence, audit dispatches, low stock tracking, and inventory valuation.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          {/* CSV Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
            title="Download client-side CSV spreadsheet of active report"
          >
            <span>📥</span> Export to CSV
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

      {/* ==================================================================== */}
      {/* SECTION 17: FOUR TABS NAVIGATION */}
      {/* 1. Inventory Report | 2. Stock-Out Report | 3. Low Stock Report | 4. Inventory Value */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl p-2 border border-neutral-200 shadow-sm flex flex-wrap gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 min-w-[140px] py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'inventory'
              ? 'bg-neutral-900 text-white shadow'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <span>📦</span> 1. Inventory Report
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stock_out')}
          className={`flex-1 min-w-[140px] py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'stock_out'
              ? 'bg-neutral-900 text-white shadow'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <span>📤</span> 2. Stock-Out Report
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('low_stock')}
          className={`flex-1 min-w-[140px] py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'low_stock'
              ? 'bg-neutral-900 text-white shadow'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <span>⚠️</span> 3. Low Stock Report
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('valuation')}
          className={`flex-1 min-w-[140px] py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'valuation'
              ? 'bg-red-700 text-white shadow'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <span>💰</span> 4. Inventory Value
        </button>
      </div>

      {/* Search Filter Bar (except for tab 4) */}
      {activeTab !== 'valuation' && (
        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={`Filter ${activeTab.replace('_', ' ')} records by keyword...`}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 text-neutral-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 font-bold"
              >
                &times;
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-all min-h-[44px]"
          >
            <span>📄</span> Download CSV
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: INVENTORY REPORT */}
      {/* Show Product, Category, Quantity, Status, Condition, Value */}
      {/* ==================================================================== */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-neutral-900">
                1. Comprehensive Inventory Ledger
              </h2>
              <p className="text-xs text-neutral-500">
                Displaying all active catalog hardware with unit quantities, conditions, and retail valuation.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-800 self-start sm:self-auto">
              {inventoryReportData.length} Products
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4 text-right">Value (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {inventoryReportData.map((p) => {
                  const status = getStockStatus(p);
                  const totalVal = p.stockQuantity * (p.sellingPrice ?? p.price);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => viewProductDetails(p.id)}
                      className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-neutral-900 block hover:text-red-700">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {p.sku} &bull; {p.brand} {p.model}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-neutral-700">
                        {p.category}
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-sm text-neutral-900">
                        {p.stockQuantity}
                      </td>
                      <td className="py-3.5 px-4">
                        {status === 'in_stock' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[11px]">
                            In Stock
                          </span>
                        ) : status === 'low_stock' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-300 text-[11px]">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200 text-[11px]">
                            Out of Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold border border-neutral-200 text-[11px]">
                          {p.condition}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-neutral-900">
                        ETB {totalVal.toLocaleString()}
                        <span className="text-[10px] text-neutral-400 font-normal block">
                          @ {p.price.toLocaleString()} / unit
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: STOCK-OUT REPORT */}
      {/* Show Product, Quantity removed, Reason, Date, User */}
      {/* ==================================================================== */}
      {activeTab === 'stock_out' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-neutral-900">
                2. Stock-Out Dispatch Log
              </h2>
              <p className="text-xs text-neutral-500">
                Chronological record of every inventory unit removed from stock with authorized personnel and reason.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-800 self-start sm:self-auto">
              {stockOutReportData.length} Dispatches Recorded
            </span>
          </div>

          {stockOutReportData.length === 0 ? (
            <div className="p-10 text-center text-xs text-neutral-500">
              No stock-out events matched your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4 text-center">Quantity Removed</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Authorized User</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {stockOutReportData.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => tx.productId && viewProductDetails(tx.productId)}
                      className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-neutral-900 block hover:text-red-700">
                          {tx.productName}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {tx.sku}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-black border border-red-200 text-xs">
                          {tx.quantityChange} units
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-bold border border-neutral-200 text-[11px]">
                          {tx.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-600 whitespace-nowrap">
                        {tx.timestamp}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-neutral-800 whitespace-nowrap">
                        👤 {tx.user}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-neutral-600">
                        <p className="line-clamp-2">{tx.notes || '—'}</p>
                        {tx.serialNumbers && tx.serialNumbers.length > 0 && (
                          <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">
                            Serials: {tx.serialNumbers.join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: LOW STOCK REPORT */}
      {/* Show products below minimum stock */}
      {/* ==================================================================== */}
      {activeTab === 'low_stock' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-neutral-900">
                3. Low Stock & Critical Replenishment Report
              </h2>
              <p className="text-xs text-neutral-500">
                All products at or below their safety reorder buffer threshold, prioritized by largest deficit.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 self-start sm:self-auto">
              {lowStockReportData.length} Reorder Alerts
            </span>
          </div>

          {lowStockReportData.length === 0 ? (
            <div className="p-10 text-center text-xs text-neutral-500">
              🎉 No products are currently below their minimum stock level!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">On-Hand Stock</th>
                    <th className="py-3 px-4 text-center">Min Buffer</th>
                    <th className="py-3 px-4 text-center">Deficit</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {lowStockReportData.map((p) => {
                    const deficit = Math.max(0, p.lowStockThreshold - p.stockQuantity);
                    const isOut = p.stockQuantity === 0;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => viewProductDetails(p.id)}
                        className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-neutral-900 block hover:text-red-700">
                            {p.name}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {p.sku} &bull; {p.brand}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-neutral-700">
                          {p.category}
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-sm">
                          <span className={isOut ? 'text-red-600' : 'text-amber-700'}>
                            {p.stockQuantity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-neutral-700">
                          {p.lowStockThreshold} units
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-xs text-red-600">
                          -{deficit} units
                        </td>
                        <td className="py-3.5 px-4">
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[11px] border border-red-200">
                              🔴 Out of Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300">
                              🟠 Low Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-600">
                          {p.supplier || 'Hawassa Partner'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewProductDetails(p.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[11px]"
                          >
                            Restock →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: INVENTORY VALUE */}
      {/* Total Buying Value (Quantity × Buying Price) */}
      {/* Potential Sales Value (Quantity × Selling Price) */}
      {/* Potential Margin (Potential Sales Value - Total Buying Value) */}
      {/* CRITICAL: Label it clearly as "Potential Margin", NEVER "Profit". */}
      {/* ==================================================================== */}
      {activeTab === 'valuation' && (
        <div className="space-y-6">
          {/* Top Financial Valuation Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Buying Value */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Total Buying Value
              </span>
              <span className="text-2xl sm:text-3xl font-black text-neutral-900 block">
                ETB {totalBuyingValue.toLocaleString()}
              </span>
              <p className="text-xs text-neutral-500">
                Calculated as: <span className="font-mono">Quantity × Buying Price</span>
              </p>
            </div>

            {/* Potential Sales Value */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block">
                Potential Sales Value
              </span>
              <span className="text-2xl sm:text-3xl font-black text-red-700 block">
                ETB {totalSalesValue.toLocaleString()}
              </span>
              <p className="text-xs text-neutral-500">
                Calculated as: <span className="font-mono">Quantity × Selling Price</span>
              </p>
            </div>

            {/* Potential Margin (NEVER Profit) */}
            <div className="bg-white rounded-2xl p-5 border-2 border-emerald-300 bg-emerald-50/40 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 block">
                  Potential Margin
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  +{potentialMarginRatio}%
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 block">
                +ETB {potentialMargin.toLocaleString()}
              </span>
              <p className="text-xs text-emerald-800 font-medium">
                Potential Margin = Potential Sales Value - Total Buying Value
              </p>
            </div>
          </div>

          {/* Category Financial Breakdown Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 sm:p-5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">
                  Valuation Breakdown by Hardware Category
                </h3>
                <p className="text-xs text-neutral-500">
                  Sub-total valuations and potential margins across all four store departments.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                Export Valuation CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-center">Units On Hand</th>
                    <th className="py-3 px-4 text-right">Total Buying Value</th>
                    <th className="py-3 px-4 text-right">Potential Sales Value</th>
                    <th className="py-3 px-4 text-right">Potential Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {categoryValuations.map((c) => (
                    <tr key={c.category} className="hover:bg-neutral-50">
                      <td className="py-3.5 px-4 font-extrabold text-neutral-900">
                        {c.category === 'Laptop'
                          ? '💻'
                          : c.category === 'Desktop'
                          ? '🖥️'
                          : c.category === 'Power Solutions'
                          ? '⚡'
                          : '🔧'}{' '}
                        {c.category}
                      </td>
                      <td className="py-3.5 px-4 text-center">{c.itemsCount}</td>
                      <td className="py-3.5 px-4 text-center font-bold">{c.totalUnits}</td>
                      <td className="py-3.5 px-4 text-right text-neutral-800 font-bold">
                        ETB {c.buyingVal.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-red-700 font-extrabold">
                        ETB {c.salesVal.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-black">
                        +ETB {c.margin.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-neutral-50 border-t-2 border-neutral-300 font-black text-xs text-neutral-900">
                  <tr>
                    <td className="py-3.5 px-4">GRAND TOTAL</td>
                    <td className="py-3.5 px-4 text-center">{products.length}</td>
                    <td className="py-3.5 px-4 text-center">
                      {products.reduce((s, p) => s + p.stockQuantity, 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right">ETB {totalBuyingValue.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right text-red-700">
                      ETB {totalSalesValue.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-700">
                      +ETB {potentialMargin.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
