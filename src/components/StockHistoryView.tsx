import React, { useState, useMemo } from 'react';
import { getRolePermissions, useInventoryStore, TransactionAction } from '../store/inventoryStore';

export default function StockHistoryView() {
  const { transactions, currentUserRole, setActiveView, viewProductDetails } = useInventoryStore();
  const permissions = getRolePermissions(currentUserRole);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<TransactionAction | 'all'>('all');
  const [filterReason, setFilterReason] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'timeline' | 'table'>('timeline');

  // Derive all unique reasons from transactions
  const uniqueReasons = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.reason) set.add(tx.reason);
    });
    return Array.from(set);
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterAction !== 'all' && tx.action !== filterAction) {
        return false;
      }
      if (filterReason !== 'all' && tx.reason !== filterReason) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          tx.productName.toLowerCase().includes(q) ||
          tx.sku.toLowerCase().includes(q) ||
          tx.reason.toLowerCase().includes(q) ||
          tx.user.toLowerCase().includes(q) ||
          (tx.notes && tx.notes.toLowerCase().includes(q)) ||
          (tx.serialNumbers && tx.serialNumbers.some((s) => s.toLowerCase().includes(q)));
        if (!matches) return false;
      }
      return true;
    });
  }, [transactions, filterAction, filterReason, searchQuery]);

  // Aggregate stats
  const totalStockInUnits = useMemo(() => {
    return transactions
      .filter((tx) => tx.action === 'Stock In')
      .reduce((sum, tx) => sum + Math.abs(tx.quantityChange), 0);
  }, [transactions]);

  const totalStockOutUnits = useMemo(() => {
    return transactions
      .filter((tx) => tx.action === 'Stock Out')
      .reduce((sum, tx) => sum + Math.abs(tx.quantityChange), 0);
  }, [transactions]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header & Breadcrumb */}
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
            <span className="text-red-700">Stock History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Stock History & Audit Trail</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-800 font-bold">
              {filteredTransactions.length} of {transactions.length} Records
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Section 13: Permanent chronological ledger of every restock and stock out transaction. Records are never erased.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {permissions.canManageStock && <button
            type="button"
            onClick={() => setActiveView('inventory')}
            className="text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px]"
          >
            📦 All Inventory
          </button>}
          <button
            type="button"
            onClick={() => setActiveView('stock_out')}
            className="text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px] flex items-center gap-1.5"
          >
            <span>📤</span> Stock Out
          </button>
        </div>
      </div>

      {/* Aggregate Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
            Total Movements
          </span>
          <span className="text-2xl sm:text-3xl font-black text-neutral-900 mt-1 block">
            {transactions.length}
          </span>
          <p className="text-[11px] text-neutral-500 mt-0.5">Audit log entries</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
            Total Stock In
          </span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 block">
            +{totalStockInUnits}
          </span>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Units received</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-red-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block">
            Total Stock Out
          </span>
          <span className="text-2xl sm:text-3xl font-black text-red-700 mt-1 block">
            -{totalStockOutUnits}
          </span>
          <p className="text-[11px] text-red-600/80 mt-0.5">Units dispatched</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
            Net Inventory Flow
          </span>
          <span
            className={`text-2xl sm:text-3xl font-black mt-1 block ${
              totalStockInUnits - totalStockOutUnits >= 0 ? 'text-neutral-900' : 'text-amber-700'
            }`}
          >
            {totalStockInUnits - totalStockOutUnits >= 0
              ? `+${totalStockInUnits - totalStockOutUnits}`
              : totalStockInUnits - totalStockOutUnits}
          </span>
          <p className="text-[11px] text-neutral-500 mt-0.5">Net unit balance change</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by product, SKU, reason, serial number, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 text-neutral-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 font-bold"
              >
                &times;
              </button>
            )}
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as TransactionAction | 'all')}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-red-600 min-h-[44px]"
            >
              <option value="all">All Actions</option>
              <option value="Stock In">📥 Stock In (+)</option>
              <option value="Stock Out">📤 Stock Out (-)</option>
            </select>

            {/* Reason Filter */}
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-red-600 min-h-[44px]"
            >
              <option value="all">All Reasons</option>
              {uniqueReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* View Switcher: Timeline vs Table */}
            <div className="hidden sm:flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <button
                type="button"
                onClick={() => setDisplayMode('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  displayMode === 'timeline' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  displayMode === 'table' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Clear */}
        {(filterAction !== 'all' || filterReason !== 'all' || searchQuery.trim()) && (
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 text-xs">
            <span className="text-neutral-400 font-bold">Filtered:</span>
            {filterAction !== 'all' && (
              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 font-bold">
                Action: {filterAction}
              </span>
            )}
            {filterReason !== 'all' && (
              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 font-bold">
                Reason: {filterReason}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 font-bold">
                Query: "{searchQuery}"
              </span>
            )}
            <button
              onClick={() => {
                setFilterAction('all');
                setFilterReason('all');
                setSearchQuery('');
              }}
              className="text-red-700 hover:underline font-bold ml-auto"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200 space-y-3 shadow-sm">
          <span className="text-4xl">🕒</span>
          <h3 className="text-base font-extrabold text-neutral-900">No Transaction Records Found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            No stock transactions match your current search or filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterAction('all');
              setFilterReason('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold"
          >
            Clear Filters
          </button>
        </div>
      ) : displayMode === 'table' ? (
        /* TABLE VIEW (SECTION 13) */
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Change</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Authorized User</th>
                  <th className="py-3.5 px-4">Notes & Serials</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredTransactions.map((tx) => {
                  const isPositive = tx.quantityChange > 0;
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => tx.productId && viewProductDetails(tx.productId)}
                      className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-neutral-600 whitespace-nowrap">
                        {tx.timestamp}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-neutral-900 hover:text-red-700 block">
                          {tx.productName}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                          {tx.sku}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            tx.action === 'Stock In'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {tx.action === 'Stock In' ? '📥 Stock In' : '📤 Stock Out'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-black text-sm ${
                            isPositive ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? `+${tx.quantityChange}` : tx.quantityChange}
                        </span>
                        <span className="text-[10px] text-neutral-400 block font-medium">
                          Bal: {tx.resultingQuantity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-bold border border-neutral-200 text-[11px]">
                          {tx.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-700 font-semibold whitespace-nowrap">
                        👤 {tx.user}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-neutral-600">
                        <p className="line-clamp-2">{tx.notes || '—'}</p>
                        {tx.serialNumbers && tx.serialNumbers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tx.serialNumbers.map((sn) => (
                              <span
                                key={sn}
                                className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700"
                              >
                                S/N: {sn}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TIMELINE VIEW (SECTION 13) */
        <div className="space-y-4">
          <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-neutral-200 space-y-4">
            {filteredTransactions.map((tx) => {
              const isPositive = tx.quantityChange > 0;
              return (
                <div key={tx.id} className="relative group">
                  {/* Timeline bullet pin */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-4 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow ${
                      tx.action === 'Stock In'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {tx.action === 'Stock In' ? '↓' : '↑'}
                  </div>

                  {/* Card Container */}
                  <div
                    onClick={() => tx.productId && viewProductDetails(tx.productId)}
                    role="button"
                    tabIndex={0}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Action Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            tx.action === 'Stock In'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {tx.action === 'Stock In' ? '📥 Stock In' : '📤 Stock Out'}
                        </span>

                        {/* Reason Badge */}
                        <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold border border-neutral-200">
                          {tx.reason}
                        </span>

                        {/* Authorized User */}
                        <span className="text-xs text-neutral-500 font-medium">
                          by <strong className="text-neutral-800">{tx.user}</strong>
                        </span>
                      </div>

                      {/* Date and Time */}
                      <div className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                        <span>🕒</span>
                        <span>{tx.timestamp}</span>
                      </div>
                    </div>

                    {/* Middle: Product & Quantity Change */}
                    <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-neutral-900 hover:text-red-700 transition-colors">
                          {tx.productName}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                            {tx.sku}
                          </span>
                          <span className="text-xs text-neutral-400">
                            Resulting Stock: <strong>{tx.resultingQuantity} units</strong>
                          </span>
                        </div>
                      </div>

                      {/* Quantity Change Badge */}
                      <div className="text-right self-start sm:self-auto">
                        <span
                          className={`inline-block px-3 py-1 rounded-xl text-base font-black ${
                            isPositive
                              ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-300'
                              : 'bg-red-100/70 text-red-800 border border-red-300'
                          }`}
                        >
                          {isPositive ? `+${tx.quantityChange}` : tx.quantityChange} units
                        </span>
                      </div>
                    </div>

                    {/* Notes & Serial Numbers */}
                    {(tx.notes || (tx.serialNumbers && tx.serialNumbers.length > 0)) && (
                      <div className="pt-2 text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100 space-y-1.5">
                        {tx.notes && <p className="leading-relaxed">{tx.notes}</p>}

                        {tx.serialNumbers && tx.serialNumbers.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-200/60">
                            <span className="text-[10px] font-bold uppercase text-neutral-400">
                              Tracked Serials:
                            </span>
                            {tx.serialNumbers.map((sn) => (
                              <span
                                key={sn}
                                className="font-mono text-[11px] bg-white border border-neutral-200 px-2 py-0.5 rounded font-bold text-neutral-800"
                              >
                                {sn}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 13 & 24 Compliance Guarantee Banner */}
      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-600 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🛡️</span>
          <span>
            <strong>Hawassa-Ketema Audit Guarantee:</strong> Historical stock transactions are permanent and immutable. All movements dynamically sync with the Dashboard, Inventory, Out of Stock, and Low Stock views.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="text-red-700 hover:text-red-800 font-bold whitespace-nowrap"
        >
          Return to Dashboard →
        </button>
      </div>
    </div>
  );
}
