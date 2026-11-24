import React, { useState } from 'react';
import { getRolePermissions, useInventoryStore, UserRole } from '../store/inventoryStore';

export default function SettingsView() {
  const { setActiveView, setCurrentUser, currentUserRole, setUserRole } = useInventoryStore();
  const permissions = getRolePermissions(currentUserRole);

  const [storeName, setStoreName] = useState('Hawassa-Ketema Computers');
  const [storeAddress, setStoreAddress] = useState('Main Street, Alamura / Piassa, Hawassa, Sidama, Ethiopia');
  const [phone, setPhone] = useState('+251 91 600 0000');
  const [currency] = useState('ETB (Ethiopian Birr)');
  const [defaultLowStockAlert, setDefaultLowStockAlert] = useState(4);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canManageSettings) return;
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200/80 pb-4">
        <div>
          <span className="text-xs font-bold text-red-700 uppercase tracking-widest">
            Configuration
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Store & System Settings
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Hawassa-Ketema Computers store profile, role-based defense-in-depth, and preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px]"
        >
          ← Dashboard
        </button>
      </div>

      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold animate-in fade-in">
          ✓ Preferences updated for this browser session.
        </div>
      )}

      {/* Role Management Card (Defense-in-depth) */}
      <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-neutral-900">
              User Role & Access Control (Defense-in-Depth)
            </h3>
            <p className="text-xs text-neutral-500">
              Select a demo role to preview its access level and store action guards.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black ${
              currentUserRole === 'Admin'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : currentUserRole === 'Staff'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : currentUserRole === 'Customer'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-neutral-100 text-neutral-800 border border-neutral-300'
            }`}
          >
            Role: {currentUserRole}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {(['Admin', 'Staff', 'Viewer', 'Customer'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setUserRole(role);
                  setCurrentUser(
                    role === 'Viewer'
                      ? 'Audit Inspector (Viewer)'
                      : role === 'Customer'
                        ? 'Customer'
                        : role === 'Staff'
                          ? 'Genene (Staff)'
                          : 'Genene (Admin)'
                  );
                  setActiveView('dashboard');
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  currentUserRole === role
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-md'
                    : 'border-neutral-200 bg-neutral-50 hover:bg-white text-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm">{role}</span>
                  {currentUserRole === role && <span className="text-xs font-black">✓ Active</span>}
                </div>
                <p className={`text-[11px] mt-1 ${currentUserRole === role ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  {role === 'Admin'
                    ? 'Full administrative control over all transactions and catalog.'
                    : role === 'Staff'
                    ? 'Can add products and process stock changes; cannot edit existing product details.'
                    : role === 'Customer'
                      ? 'Customer storefront for browsing products and placing demo orders.'
                      : 'Read-only access. Mutation actions immediately return errors.'}
                </p>
              </button>
            ))}
        </div>

        {currentUserRole === 'Viewer' && (
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs font-medium space-y-1">
            <span className="font-bold block flex items-center gap-1.5">
              <span>🛡️</span> Defense-in-Depth Guard Active:
            </span>
            <p>
              In <strong>Viewer</strong> mode, the Zustand store actions (<code>stockOut</code>, <code>stockIn</code>, <code>addProduct</code>, and <code>updateProduct</code>) are completely locked. Any attempt to invoke them immediately returns an authorization error and prevents state mutation.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Store & Brand Name
          </label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            disabled={!permissions.canManageSettings}
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 font-bold text-neutral-900 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Store Physical Location
          </label>
          <input
            type="text"
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
            disabled={!permissions.canManageSettings}
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-neutral-900 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Contact Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!permissions.canManageSettings}
              className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-neutral-900 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Store Currency
            </label>
            <input
              type="text"
              value={currency}
              disabled
              className="w-full px-3.5 py-3 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-600 text-sm font-semibold min-h-[48px]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
            Default Low Stock Reorder Threshold
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={defaultLowStockAlert}
            onChange={(e) => setDefaultLowStockAlert(Number(e.target.value))}
            disabled={!permissions.canManageSettings}
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-neutral-900 text-sm font-bold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
          />
          <p className="text-[11px] text-neutral-500 mt-1">
            Products at or below this count will automatically show the Orange Low Stock badge.
          </p>
        </div>

        <button
          type="submit"
          disabled={!permissions.canManageSettings}
          className="w-full py-4 rounded-2xl bg-red-700 hover:bg-red-800 text-white font-extrabold text-sm shadow-md active:scale-[0.98] transition-all min-h-[48px]"
        >
          Save Preferences
        </button>
        {!permissions.canManageSettings && <p className="text-xs text-neutral-500">Only Admin can update store settings. Role switching is available for this local demo.</p>}
      </form>
    </div>
  );
}
