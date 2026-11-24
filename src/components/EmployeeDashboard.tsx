import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  LogOut,
  PackageCheck,
  RefreshCw,
  Boxes,
  User,
  Save,
} from 'lucide-react';
import {
  listEmployeeOrders,
  updateEmployeeOrderStatus,
  assignDelivery,
  listDeliveryPersons,
  getEmployeeDashboard,
  getEmployeePermissions,
  getCurrentUser,
  updateProfile,
  clearSession,
  ApiUser,
  EmployeeOrder,
  DeliveryAssignmentPermission,
} from '../lib/api';
import { useInventoryStore } from '../store/inventoryStore';
import DeliveryManagement from './DeliveryManagement';

const STATUS_BADGE: Record<string, string> = {
  pending:     'bg-neutral-100 text-neutral-700',
  confirmed:   'bg-blue-100 text-blue-700',
  processing:  'bg-amber-100 text-amber-700',
  ready:       'bg-emerald-100 text-emerald-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
};

export default function EmployeeDashboard() {
  const { setUserRole, setCurrentUser } = useInventoryStore();
  const [tab, setTab] = useState<'overview'|'orders'|'deliveries'|'profile'>('overview');
  const [orders, setOrders] = useState<EmployeeOrder[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<Awaited<ReturnType<typeof listDeliveryPersons>>>([]);
  const [permissions, setPermissions] = useState<DeliveryAssignmentPermission[]>([]);
  const [stats, setStats] = useState({ toProcess: 0, inProgress: 0, readyForDelivery: 0 });
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string|null>(null);
  const [assigning, setAssigning] = useState<string|null>(null);
  const [assignPick, setAssignPick] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [o, d, p] = await Promise.all([listEmployeeOrders(), getEmployeeDashboard(), getEmployeePermissions()]);
      const availableDeliveryPersons = p.includes('ASSIGN_DELIVERIES') ? await listDeliveryPersons() : [];
      setOrders(o);
      setStats(d.stats);
      setPermissions(p);
      setDeliveryPersons(availableDeliveryPersons);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    getCurrentUser().then((user) => {
      setProfile(user);
      setProfileForm((current) => ({ ...current, fullName: user.fullName, phone: user.phone || '' }));
    }).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile.'));
    const interval = window.setInterval(() => void load(true), 30000);
    return () => window.clearInterval(interval);
  }, []);
  const canViewDeliveryAssignments = permissions.includes('ASSIGN_DELIVERIES')
    || permissions.includes('VIEW_ALL_DELIVERIES');
  useEffect(() => {
    if (tab === 'deliveries' && !canViewDeliveryAssignments) setTab('overview');
  }, [tab, canViewDeliveryAssignments]);

  const handleStatus = async (id: string, status: 'confirmed' | 'processing' | 'ready') => {
    setBusy(id); setNotice(''); setError('');
    try {
      await updateEmployeeOrderStatus(id, status);
      setNotice(`Order updated to "${status}".`);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update.');
    } finally {
      setBusy(null);
    }
  };

  const handleAssign = async (order: EmployeeOrder) => {
    const deliveryPersonId = assignPick[order.id] || order.deliveryPersonId || '';
    if (!deliveryPersonId) {
      setError('Select a delivery person first.');
      return;
    }
    setAssigning(order.id); setNotice(''); setError('');
    try {
      await assignDelivery(order.id, deliveryPersonId);
      setNotice('Delivery person assigned successfully.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign delivery.');
    } finally {
      setAssigning(null);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('profile'); setError(''); setNotice('');
    try {
      const { user } = await updateProfile({
        fullName: profileForm.fullName.trim(),
        phone: profileForm.phone.trim() || null,
        ...(profileForm.newPassword ? {
          currentPassword: profileForm.currentPassword,
          newPassword: profileForm.newPassword,
          confirmPassword: profileForm.confirmPassword,
        } : {}),
      });
      setProfile(user);
      setCurrentUser(`${user.fullName} (Employee)`);
      setProfileForm((current) => ({ ...current, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setNotice('Profile updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update profile.');
    } finally {
      setBusy(null);
    }
  };

  const canAssignDeliveries = permissions.includes('ASSIGN_DELIVERIES');
  const canReassignDeliveries = permissions.includes('REASSIGN_DELIVERIES');
  const signOut = () => { clearSession(); setUserRole('Customer'); setCurrentUser('Guest'); };

  const navBtn = (t: typeof tab, label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-red-700 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-neutral-950 text-white border-b border-white/10">
        <div className="mx-auto max-w-6xl flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-700 font-black text-sm">HK</span>
            <div>
              <p className="text-sm font-extrabold leading-tight">Hawassa-Ketema</p>
              <p className="text-[9px] uppercase tracking-widest text-neutral-400">Employee Portal</p>
            </div>
          </div>
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-300 hover:text-white transition">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <nav className="hidden md:flex w-44 flex-col gap-1 shrink-0">
          {navBtn('overview', 'Overview', Boxes)}
          {navBtn('orders', 'Orders', ClipboardList)}
          {canViewDeliveryAssignments && navBtn('deliveries', 'Deliveries', PackageCheck)}
          {navBtn('profile', 'Profile', User)}
        </nav>

        {/* Mobile nav */}
        <div className="md:hidden flex gap-2 mb-4 w-full overflow-x-auto pb-1">
          {navBtn('overview', 'Overview', Boxes)}
          {navBtn('orders', 'Orders', ClipboardList)}
          {canViewDeliveryAssignments && navBtn('deliveries', 'Deliveries', PackageCheck)}
          {navBtn('profile', 'Profile', User)}
        </div>

        <main className="flex-1 min-w-0">
          {notice && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={16} /> {notice}
              <button type="button" onClick={() => setNotice('')} className="ml-auto">×</button>
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Overview */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <h1 className="text-xl font-black tracking-tight">Employee Overview</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'To Process', value: stats.toProcess, color: 'bg-blue-50 text-blue-700' },
                  { label: 'In Progress', value: stats.inProgress, color: 'bg-amber-50 text-amber-700' },
                  { label: 'Ready for Delivery', value: stats.readyForDelivery, color: 'bg-emerald-50 text-emerald-700' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl border p-5 ${s.color} border-current/20`}>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-70">{s.label}</p>
                    <p className="mt-1 text-3xl font-black">{loading ? '…' : s.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                <p className="text-sm font-bold text-neutral-700 mb-3">Recent orders awaiting employee action</p>
                {loading ? <p className="text-sm text-neutral-500">Loading…</p> : (
                  <div className="space-y-2">
                    {orders.filter(o => ['pending', 'confirmed'].includes(o.status)).slice(0, 5).map(o => {
                      const needsPaymentVerification = o.paymentMethod === 'Bank transfer' && o.paymentStatus !== 'verified';
                      return (
                        <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-2.5">
                          <div>
                            <p className="text-sm font-bold">{o.orderNumber}</p>
                            <p className="text-xs text-neutral-500">{o.customerName} · {o.items.length} item{o.items.length !== 1 ? 's' : ''} · {o.status}</p>
                          </div>
                          <button
                            type="button"
                            disabled={!!busy || needsPaymentVerification}
                            onClick={() => handleStatus(o.id, o.status === 'pending' ? 'confirmed' : 'processing')}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {needsPaymentVerification ? 'Awaiting payment verification' : o.status === 'pending' ? 'Confirm order' : 'Start processing'}
                          </button>
                        </div>
                      );
                    })}
                    {orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length === 0 && (
                      <p className="text-sm text-neutral-500">No new orders need confirmation or processing.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-black tracking-tight">All Orders</h1>
                <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 disabled:opacity-40">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              {loading ? <p className="text-sm text-neutral-500">Loading…</p> : (
                <div className="space-y-3">
                  {orders.map(o => (
                    <div key={o.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold">{o.orderNumber}</p>
                          <p className="text-xs text-neutral-500">{o.customerName} · {o.phone}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">{o.deliveryAddress}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[o.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                          {o.status}
                        </span>
                      </div>
                      <div className="mt-3 border-t border-neutral-100 pt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-neutral-600">
                          {o.items.map(i => `${i.name} ×${i.quantity}`).join(' · ')}
                          <p className="mt-1 text-neutral-500">
                            Payment: {o.paymentMethod} ({o.paymentStatus.replace(/_/g, ' ')})
                            {' · '}Delivery: {o.deliveryStatus.replace(/_/g, ' ')}
                            {o.deliveryPersonName ? ` · ${o.deliveryPersonName}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {o.status === 'pending' && (
                            <button type="button" disabled={busy === o.id || (o.paymentMethod === 'Bank transfer' && o.paymentStatus !== 'verified')} onClick={() => handleStatus(o.id, 'confirmed')}
                              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                              {busy === o.id ? '…' : o.paymentMethod === 'Bank transfer' && o.paymentStatus !== 'verified' ? 'Awaiting verification' : 'Confirm order'}
                            </button>
                          )}
                          {o.status === 'confirmed' && (
                            <button type="button" disabled={busy === o.id || (o.paymentMethod === 'Bank transfer' && o.paymentStatus !== 'verified')} onClick={() => handleStatus(o.id, 'processing')}
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                              {busy === o.id ? '…' : o.paymentMethod === 'Bank transfer' && o.paymentStatus !== 'verified' ? 'Awaiting verification' : 'Processing'}
                            </button>
                          )}
                          {o.status === 'processing' && (
                            <button type="button" disabled={busy === o.id} onClick={() => handleStatus(o.id, 'ready')}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                              {busy === o.id ? '…' : 'Mark Ready'}
                            </button>
                          )}
                          {(o.status === 'ready' || o.status === 'completed') && (
                            <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-500">
                              <PackageCheck size={12} className="inline mr-1" />{o.status}
                            </span>
                          )}
                        </div>
                      </div>
                      {o.status === 'ready' && ['unassigned', 'assigned', 'failed', 'returned'].includes(o.deliveryStatus) && (
                        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-neutral-600">Delivery assignment</p>
                          {o.deliveryPersonName ? (
                            <p className="mt-1 text-sm text-neutral-700">
                              Currently assigned to <span className="font-bold">{o.deliveryPersonName}</span>
                              {o.assignedAt && <span className="text-xs text-neutral-500"> · {new Date(o.assignedAt).toLocaleString()}</span>}
                            </p>
                          ) : <p className="mt-1 text-sm text-neutral-500">No delivery person assigned.</p>}

                          {!canAssignDeliveries && (
                            <p className="mt-2 text-xs text-neutral-500">Ask an administrator to grant you the Assign Deliveries permission.</p>
                          )}
                          {canAssignDeliveries && o.deliveryPersonId && !canReassignDeliveries && (
                            <p className="mt-2 text-xs text-neutral-500">Reassigning this order requires additional administrator-granted permission.</p>
                          )}
                          {canAssignDeliveries && (!o.deliveryPersonId || canReassignDeliveries) && (
                            deliveryPersons.length === 0 ? (
                              <p className="mt-2 text-xs text-neutral-500">No active delivery persons are available.</p>
                            ) : (
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <select
                                  aria-label={`Delivery person for order ${o.orderNumber}`}
                                  value={assignPick[o.id] ?? o.deliveryPersonId ?? ''}
                                  onChange={e => setAssignPick(current => ({ ...current, [o.id]: e.target.value }))}
                                  className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                                >
                                  <option value="">Select delivery person…</option>
                                  {deliveryPersons.map(person => (
                                    <option key={person.id} value={person.id}>{person.fullName}</option>
                                  ))}
                                </select>
                                <button type="button" disabled={!!assigning} onClick={() => void handleAssign(o)}
                                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
                                  {assigning === o.id ? 'Assigning…' : o.deliveryPersonId ? 'Reassign delivery' : 'Assign delivery'}
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                      {o.customerConfirmationStatus === 'customer_confirmed' && (
                        <div role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                          <p className="font-bold">Delivery confirmation: customer confirmed receipt.</p>
                          {o.customerConfirmedAt && <p className="mt-1 text-xs">Confirmed {new Date(o.customerConfirmedAt).toLocaleString()}</p>}
                        </div>
                      )}
                      {o.customerConfirmationStatus === 'issue_reported' && (
                        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                          <p className="font-bold">Delivery confirmation: customer reports the order was not received.</p>
                          {o.customerDeliveryIssueReportedAt && <p className="mt-1 text-xs">Reported {new Date(o.customerDeliveryIssueReportedAt).toLocaleString()}</p>}
                          {o.customerDeliveryIssue && <p className="mt-1 whitespace-pre-wrap">{o.customerDeliveryIssue}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                  {orders.length === 0 && <p className="text-sm text-neutral-500">No orders found.</p>}
                </div>
              )}
            </div>
          )}

          {tab === 'deliveries' && canViewDeliveryAssignments && (
            <DeliveryManagement permissions={permissions} />
          )}

          {/* Profile */}
          {tab === 'profile' && (
            <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
              <h1 className="mb-4 text-xl font-black tracking-tight">My Profile</h1>
              <form onSubmit={saveProfile} className="space-y-3">
                <label className="block text-xs font-semibold text-neutral-600">Full name
                  <input required minLength={2} maxLength={120} value={profileForm.fullName} onChange={e => setProfileForm(current => ({ ...current, fullName: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">Email
                  <input readOnly value={profile?.email || ''} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm" />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">Phone
                  <input type="tel" maxLength={30} value={profileForm.phone} onChange={e => setProfileForm(current => ({ ...current, phone: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                </label>
                <p className="text-xs font-semibold text-neutral-400">Role: Employee</p>
                <div className="space-y-3 border-t border-neutral-100 pt-3">
                  <p className="text-xs font-bold text-neutral-700">Change password (optional)</p>
                  <label className="block text-xs font-semibold text-neutral-600">Current password
                    <input type="password" autoComplete="current-password" value={profileForm.currentPassword} onChange={e => setProfileForm(current => ({ ...current, currentPassword: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">New password
                    <input type="password" minLength={8} autoComplete="new-password" value={profileForm.newPassword} onChange={e => setProfileForm(current => ({ ...current, newPassword: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">Confirm new password
                    <input type="password" minLength={8} autoComplete="new-password" value={profileForm.confirmPassword} onChange={e => setProfileForm(current => ({ ...current, confirmPassword: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                  </label>
                </div>
                <button type="submit" disabled={busy === 'profile'} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
                  <Save size={15} /> {busy === 'profile' ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
