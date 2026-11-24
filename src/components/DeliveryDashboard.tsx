import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  LogOut,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  RefreshCw,
  Truck,
  User,
  History,
  Save,
} from 'lucide-react';
import {
  getCurrentUser,
  listMyDeliveries,
  updateDeliveryStatus,
  clearSession,
  updateProfile,
  ApiUser,
  DeliveryOrder,
  DeliveryStatus,
} from '../lib/api';
import { useInventoryStore } from '../store/inventoryStore';
import OrderCommunication from './OrderCommunication';

const DS_BADGE: Record<string, string> = {
  unassigned:      'bg-neutral-100 text-neutral-600',
  assigned:        'bg-blue-100 text-blue-700',
  accepted:        'bg-indigo-100 text-indigo-700',
  out_for_delivery:'bg-amber-100 text-amber-700',
  delivered:       'bg-emerald-100 text-emerald-700',
  failed:          'bg-red-100 text-red-700',
  returned:        'bg-orange-100 text-orange-700',
};

export default function DeliveryDashboard() {
  const { setUserRole, setCurrentUser } = useInventoryStore();
  const [tab, setTab] = useState<'active'|'history'|'profile'>('active');
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [profile, setProfile] = useState<ApiUser|null>(null);
  const [profileForm, setProfileForm] = useState({fullName:'',phone:'',currentPassword:'',newPassword:'',confirmPassword:''});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string|null>(null);
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});
  const [failureReasonInput, setFailureReasonInput] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      setDeliveries(await listMyDeliveries());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30000);
    getCurrentUser().then((user) => {
      setProfile(user);
      setProfileForm((current) => ({...current,fullName:user.fullName,phone:user.phone||''}));
    }).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile.'));
    return () => window.clearInterval(interval);
  }, []);

  const handleStatus = async (id: string, status: Exclude<DeliveryStatus,'unassigned'|'assigned'>) => {
    const failureReason = failureReasonInput[id]?.trim();
    if(status==='failed'&&!failureReason){setError('Enter a reason for the failed delivery.');return;}
    setBusy(id); setNotice(''); setError('');
    try {
      await updateDeliveryStatus(id, status, noteInput[id], failureReason);
      setNotice(status === 'delivered' ? 'Delivery confirmed successfully!' : 'Status updated.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status.');
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('profile'); setError(''); setNotice('');
    try {
      const {user} = await updateProfile({
        fullName:profileForm.fullName.trim(),
        phone:profileForm.phone.trim()||null,
        ...(profileForm.newPassword?{
          currentPassword:profileForm.currentPassword,
          newPassword:profileForm.newPassword,
          confirmPassword:profileForm.confirmPassword,
        }:{}),
      });
      setProfile(user);
      setCurrentUser(`${user.fullName} (Delivery)`);
      setProfileForm((current)=>({...current,currentPassword:'',newPassword:'',confirmPassword:''}));
      setNotice('Profile updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update profile.');
    } finally {
      setBusy(null);
    }
  };

  const signOut = () => { clearSession(); setUserRole('Customer'); setCurrentUser('Guest'); };

  const active = deliveries.filter(d => !['delivered','failed','returned'].includes(d.deliveryStatus));
  const history = deliveries.filter(d => ['delivered','returned','failed'].includes(d.deliveryStatus));

  const navBtn = (t: typeof tab, label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-red-700 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  const DeliveryCard = ({ d }: { d: DeliveryOrder }) => {
    const [messagesOpen, setMessagesOpen] = useState(false);
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold">{d.orderNumber}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
                Ordered {new Date(d.createdAt).toLocaleDateString()} · Assigned {d.assignedAt ? new Date(d.assignedAt).toLocaleDateString() : '—'}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${DS_BADGE[d.deliveryStatus] ?? 'bg-neutral-100'}`}>
          {d.deliveryStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Customer info */}
      <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <User size={14} className="text-red-500 shrink-0" /> {d.customerName}
        </div>
        <a href={`tel:${d.phone}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
          <Phone size={14} className="shrink-0" /> {d.phone}
        </a>
        <div className="flex items-start gap-2 text-xs text-neutral-600">
          <MapPin size={14} className="shrink-0 mt-0.5 text-red-500" /> {d.deliveryAddress}
        </div>
      </div>

      {/* Items */}
      <div className="text-xs text-neutral-500 space-y-0.5">
        {d.items.map((i, idx) => (
          <p key={`${i.sku}-${idx}`}>{i.name} <span className="font-bold">×{i.quantity}</span> · ETB {Number(i.unitPrice).toLocaleString()}</p>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
        <span>{d.paymentMethod} · {d.paymentStatus.replace(/_/g,' ')}</span>
        <span className="font-bold">Total ETB {Number(d.total).toLocaleString()}</span>
        {d.acceptedAt && <span>Accepted {new Date(d.acceptedAt).toLocaleString()}</span>}
        {d.outForDeliveryAt && <span>Started {new Date(d.outForDeliveryAt).toLocaleString()}</span>}
        {d.deliveredAt && <span>Delivered {new Date(d.deliveredAt).toLocaleString()}</span>}
      </div>
      {d.customerConfirmationStatus === 'customer_confirmed' && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-bold">Customer confirmed receipt of this delivery.</p>
          {d.customerConfirmedAt && <p className="mt-1 text-xs">Confirmed {new Date(d.customerConfirmedAt).toLocaleString()}</p>}
        </div>
      )}
      {d.customerConfirmationStatus === 'issue_reported' && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-bold">Customer reports this order was not received. Please refer the concern to an administrator.</p>
          {d.customerDeliveryIssueReportedAt && <p className="mt-1 text-xs">Reported {new Date(d.customerDeliveryIssueReportedAt).toLocaleString()}</p>}
          {d.customerDeliveryIssue && <p className="mt-1 whitespace-pre-wrap">{d.customerDeliveryIssue}</p>}
        </div>
      )}

      {/* Actions */}
      {!['delivered','returned'].includes(d.deliveryStatus) && (
        <div className="border-t border-neutral-100 pt-3 space-y-2">
          <textarea
            rows={2}
            placeholder="Delivery note (optional)"
            value={noteInput[d.id] ?? ''}
            onChange={e => setNoteInput(prev => ({ ...prev, [d.id]: e.target.value }))}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs outline-none focus:border-red-400 resize-none"
          />
          {d.deliveryStatus === 'out_for_delivery' && (
            <label className="block text-xs font-semibold text-neutral-600">
              Failure reason (required if delivery fails)
              <textarea
                rows={2}
                value={failureReasonInput[d.id] ?? ''}
                onChange={e => setFailureReasonInput(prev => ({...prev,[d.id]:e.target.value}))}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs outline-none focus:border-red-400 resize-none"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {d.deliveryStatus === 'assigned' && (
              <button type="button" disabled={!!busy} onClick={() => handleStatus(d.id, 'accepted')}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy === d.id ? '…' : 'Accept delivery'}
              </button>
            )}
            {d.deliveryStatus === 'accepted' && (
              <button type="button" disabled={!!busy} onClick={() => handleStatus(d.id, 'out_for_delivery')}
                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                {busy === d.id ? '…' : 'Out for delivery'}
              </button>
            )}
            {d.deliveryStatus === 'out_for_delivery' && (
              <>
                <button type="button" disabled={!!busy} onClick={() => handleStatus(d.id, 'delivered')}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy === d.id ? '…' : '✓ Delivered'}
                </button>
                <button type="button" onClick={() => handleStatus(d.id, 'failed')}
                  aria-label={`Report failed delivery for ${d.orderNumber}`}
                  disabled={!!busy || !failureReasonInput[d.id]?.trim()}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
                  Failed attempt
                </button>
              </>
            )}
            {d.deliveryStatus === 'failed' && (
              <>
                <button type="button" disabled={!!busy} onClick={() => handleStatus(d.id, 'out_for_delivery')}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                  Retry delivery
                </button>
                <button type="button" disabled={!!busy} onClick={() => handleStatus(d.id, 'returned')}
                  className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50">
                  Return to store
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {d.failureReason && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
          Failed attempt: {d.failureReason}
        </div>
      )}
      {d.deliveryNote && (
        <div className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <MessageCircle size={12} className="shrink-0 mt-0.5" /> {d.deliveryNote}
        </div>
      )}
      <button type="button" onClick={() => setMessagesOpen(value => !value)}
        className="inline-flex items-center gap-2 text-xs font-bold text-red-700 hover:text-red-800">
        <MessageCircle size={14} /> {messagesOpen ? 'Hide messages' : 'Message customer'}
      </button>
      {messagesOpen && <OrderCommunication orderId={d.id} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-30 bg-neutral-950 text-white border-b border-white/10">
        <div className="mx-auto max-w-6xl flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-700 font-black text-sm">HK</span>
            <div>
              <p className="text-sm font-extrabold leading-tight">Hawassa-Ketema</p>
              <p className="text-[9px] uppercase tracking-widest text-neutral-400">Delivery Portal</p>
            </div>
          </div>
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-300 hover:text-white transition">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6">
        <nav className="hidden md:flex w-44 flex-col gap-1 shrink-0">
          {navBtn('active', 'My Deliveries', Truck)}
          {navBtn('history', 'History', History)}
          {navBtn('profile', 'Profile', User)}
        </nav>

        <div className="md:hidden flex gap-2 mb-4 w-full overflow-x-auto pb-1">
          {navBtn('active', 'Deliveries', Truck)}
          {navBtn('history', 'History', History)}
          {navBtn('profile', 'Profile', User)}
        </div>

        <main className="flex-1 min-w-0 space-y-4">
          {notice && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={16} /> {notice}
              <button type="button" onClick={() => setNotice('')} className="ml-auto">×</button>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {tab === 'active' && (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-black tracking-tight">
                  My Deliveries <span className="text-base font-semibold text-neutral-500">({active.length})</span>
                </h1>
                <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 disabled:opacity-40">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              {loading ? <p className="text-sm text-neutral-500">Loading…</p> : active.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
                  <PackageCheck size={28} className="mx-auto mb-3 text-neutral-300" />
                  No active deliveries assigned to you.
                </div>
              ) : (
                <div className="space-y-3">{active.map(d => <DeliveryCard key={d.id} d={d} />)}</div>
              )}
            </>
          )}

          {tab === 'history' && (
            <>
              <h1 className="text-xl font-black tracking-tight">Delivery History</h1>
              {loading ? <p className="text-sm text-neutral-500">Loading…</p> : history.length === 0 ? (
                <p className="text-sm text-neutral-500">No completed deliveries yet.</p>
              ) : (
                <div className="space-y-3">{history.map(d => <DeliveryCard key={d.id} d={d} />)}</div>
              )}
            </>
          )}

          {tab === 'profile' && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 max-w-md">
              <h1 className="text-xl font-black tracking-tight mb-4">My Profile</h1>
              <form onSubmit={saveProfile} className="space-y-3">
                <label className="block text-xs font-semibold text-neutral-600">Full name
                  <input required minLength={2} maxLength={120} value={profileForm.fullName} onChange={e=>setProfileForm(current=>({...current,fullName:e.target.value}))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">Email
                  <input readOnly value={profile?.email||''} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm" />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">Phone
                  <input type="tel" maxLength={30} value={profileForm.phone} onChange={e=>setProfileForm(current=>({...current,phone:e.target.value}))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                </label>
                <p className="text-xs font-semibold text-neutral-400">Role: Delivery Person</p>
                <div className="border-t border-neutral-100 pt-3 space-y-3">
                  <p className="text-xs font-bold text-neutral-700">Change password (optional)</p>
                  <label className="block text-xs font-semibold text-neutral-600">Current password
                    <input type="password" autoComplete="current-password" value={profileForm.currentPassword} onChange={e=>setProfileForm(current=>({...current,currentPassword:e.target.value}))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">New password
                    <input type="password" minLength={8} autoComplete="new-password" value={profileForm.newPassword} onChange={e=>setProfileForm(current=>({...current,newPassword:e.target.value}))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">Confirm new password
                    <input type="password" minLength={8} autoComplete="new-password" value={profileForm.confirmPassword} onChange={e=>setProfileForm(current=>({...current,confirmPassword:e.target.value}))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" />
                  </label>
                </div>
                <button type="submit" disabled={busy==='profile'} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
                  <Save size={15} /> {busy==='profile'?'Saving…':'Save profile'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
