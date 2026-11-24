import { Fragment, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  listStaff,
  createStaff,
  updateStaff,
  setStaffStatus,
  updateStaffPermissions,
  StaffMember,
  DeliveryAssignmentPermission,
} from '../lib/api';

const ROLE_BADGE: Record<string, string> = {
  employee:        'bg-blue-100 text-blue-700',
  delivery_person: 'bg-amber-100 text-amber-700',
};
const DELIVERY_PERMISSION_OPTIONS: Array<{
  id: DeliveryAssignmentPermission;
  title: string;
  description: string;
}> = [
  { id: 'ASSIGN_DELIVERIES', title: 'Assign deliveries', description: 'Assign eligible ready orders to active delivery persons.' },
  { id: 'REASSIGN_DELIVERIES', title: 'Reassign deliveries', description: 'Change the delivery person on an existing assignment.' },
  { id: 'VIEW_ALL_DELIVERIES', title: 'View all deliveries', description: 'View assignment records across employees and delivery persons.' },
];

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'employee'|'delivery_person'>('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  /* Create form */
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName:'', email:'', phone:'', role:'employee' as 'employee'|'delivery_person', password:'' });
  const [busy, setBusy] = useState(false);

  /* Edit form */
  const [editing, setEditing] = useState<string|null>(null);
  const [editForm, setEditForm] = useState({ fullName:'', phone:'', newPassword:'' });
  const [permissionEditing, setPermissionEditing] = useState<string|null>(null);
  const [permissionSelection, setPermissionSelection] = useState<DeliveryAssignmentPermission[]>([]);

  const load = async () => {
    setLoading(true);
    try { setStaff(await listStaff()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load staff.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filtered = staff.filter(s => {
    const matchesRole = filter === 'all' || s.role === filter;
    const matchesSearch = !search || s.fullName.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await createStaff(form);
      setNotice(`${form.role === 'employee' ? 'Employee' : 'Delivery person'} "${form.fullName}" created.`);
      setShowForm(false);
      setForm({ fullName:'', email:'', phone:'', role:'employee', password:'' });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create.');
    } finally { setBusy(false); }
  };

  const handleEdit = async (id: string) => {
    setBusy(true); setError('');
    try {
      await updateStaff(id, { fullName: editForm.fullName, phone: editForm.phone || null, newPassword: editForm.newPassword || undefined });
      setNotice('Staff member updated.');
      setEditing(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update.');
    } finally { setBusy(false); }
  };

  const toggleStatus = async (s: StaffMember) => {
    setBusy(true); setError('');
    try {
      await setStaffStatus(s.id, !s.isActive);
      setNotice(`${s.fullName} ${s.isActive ? 'deactivated' : 'activated'}.`);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally { setBusy(false); }
  };

  const togglePermission = (permission: DeliveryAssignmentPermission) => {
    setPermissionSelection(current => {
      if (current.includes(permission)) {
        return permission === 'ASSIGN_DELIVERIES'
          ? current.filter(item => item !== permission && item !== 'REASSIGN_DELIVERIES')
          : current.filter(item => item !== permission);
      }
      return [...current, permission];
    });
  };

  const handleSavePermissions = async (employeeId: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const permissions = await updateStaffPermissions(employeeId, permissionSelection);
      setStaff(current => current.map(member => member.id === employeeId ? { ...member, permissions } : member));
      setPermissionEditing(null);
      setNotice('Employee permissions updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee permissions.');
    } finally { setBusy(false); }
  };

  const inputCls = 'mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Staff Management</h1>
        <button type="button" onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 transition">
          <Plus size={16} /> Add staff member
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={16} /> {notice}
          <button type="button" onClick={() => setNotice('')} className="ml-auto">×</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-base font-extrabold mb-4">New staff account</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              Full name *
              <input required minLength={2} value={form.fullName} onChange={e => setForm(f => ({...f, fullName: e.target.value}))} className={inputCls} placeholder="Abebe Kebede" />
            </label>
            <label className="block text-sm font-semibold">
              Email *
              <input required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className={inputCls} placeholder="abebe@example.com" />
            </label>
            <label className="block text-sm font-semibold">
              Phone
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className={inputCls} placeholder="+251 9XX XXX XXX" />
            </label>
            <label className="block text-sm font-semibold">
              Role *
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value as typeof form.role}))} className={inputCls}>
                <option value="employee">Employee</option>
                <option value="delivery_person">Delivery person</option>
              </select>
            </label>
            <label className="block text-sm font-semibold sm:col-span-2">
              Password *
              <input required type="password" minLength={8} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className={inputCls} placeholder="Min. 8 characters" />
            </label>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={busy} className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
                {busy ? 'Creating…' : 'Create account'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <label className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm text-neutral-500 focus-within:border-red-500 w-52">
          <Search size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff…" className="bg-transparent outline-none flex-1 text-neutral-800 placeholder:text-neutral-400" />
        </label>
        {(['all','employee','delivery_person'] as const).map(r => (
          <button key={r} type="button" onClick={() => setFilter(r)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${filter === r ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}>
            {r === 'all' ? 'All' : r === 'employee' ? 'Employees' : 'Delivery persons'}
          </button>
        ))}
        <button type="button" onClick={load} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Staff list */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-neutral-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No staff members found.</p>
        ) : (
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(s => (
                <Fragment key={s.id}>
                  <tr className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-semibold">{s.fullName}</td>
                    <td className="px-4 py-3 text-neutral-600">{s.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ROLE_BADGE[s.role]}`}>
                        {s.role === 'employee' ? 'Employee' : 'Delivery'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {s.role === 'employee' && (
                          <button type="button" onClick={() => {
                            setPermissionEditing(permissionEditing === s.id ? null : s.id);
                            setPermissionSelection(s.permissions ?? []);
                            setError('');
                          }}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                            <ShieldCheck size={12} /> Permissions
                          </button>
                        )}
                        <button type="button" onClick={() => { setEditing(s.id); setEditForm({ fullName: s.fullName, phone: s.phone ?? '', newPassword: '' }); }}
                          className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">
                          Edit
                        </button>
                        <button type="button" disabled={busy} onClick={() => toggleStatus(s)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${s.isActive ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                          {s.isActive ? <><UserX size={12} className="inline mr-1" />Deactivate</> : <><UserCheck size={12} className="inline mr-1" />Activate</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editing === s.id && (
                    <tr>
                      <td colSpan={5} className="bg-neutral-50 px-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
                          <label className="block text-xs font-semibold">
                            Full name
                            <input value={editForm.fullName} onChange={e => setEditForm(f => ({...f, fullName: e.target.value}))} className={inputCls} />
                          </label>
                          <label className="block text-xs font-semibold">
                            Phone
                            <input value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} className={inputCls} placeholder="optional" />
                          </label>
                          <label className="block text-xs font-semibold">
                            New password
                            <input type="password" minLength={8} value={editForm.newPassword} onChange={e => setEditForm(f => ({...f, newPassword: e.target.value}))} className={inputCls} placeholder="leave blank to keep" />
                          </label>
                          <div className="sm:col-span-3 flex gap-2">
                            <button type="button" disabled={busy} onClick={() => handleEdit(s.id)}
                              className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-60">
                              {busy ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {permissionEditing === s.id && s.role === 'employee' && (
                    <tr>
                      <td colSpan={5} className="bg-red-50/50 px-4 py-4">
                        <div className="max-w-3xl space-y-4">
                          <div>
                            <h3 className="font-extrabold text-neutral-900">Delivery permissions for {s.fullName}</h3>
                            <p className="mt-1 text-xs text-neutral-600">These settings are enforced by the server and take effect on the employee’s next request.</p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            {DELIVERY_PERMISSION_OPTIONS.map(permission => (
                              <label key={permission.id} className="flex cursor-pointer gap-3 rounded-xl border border-neutral-200 bg-white p-3">
                                <input type="checkbox" checked={permissionSelection.includes(permission.id)}
                                  disabled={permission.id === 'REASSIGN_DELIVERIES' && !permissionSelection.includes('ASSIGN_DELIVERIES')}
                                  onChange={() => togglePermission(permission.id)}
                                  className="mt-0.5 h-4 w-4 accent-red-700" />
                                <span>
                                  <span className="block text-sm font-bold">{permission.title}</span>
                                  <span className="mt-1 block text-xs text-neutral-500">{permission.description}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" disabled={busy} onClick={() => void handleSavePermissions(s.id)}
                              className="rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50">
                              {busy ? 'Saving…' : 'Save permissions'}
                            </button>
                            <button type="button" disabled={busy} onClick={() => setPermissionEditing(null)}
                              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
