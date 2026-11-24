import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Truck, User } from 'lucide-react';
import {
  listAllDeliveries,
  assignDelivery,
  unassignDelivery,
  listDeliveryPersons,
  getDeliveryAssignmentHistory,
  DeliveryOrder,
  DeliveryAssignmentHistory,
  DeliveryAssignmentPermission,
} from '../lib/api';

const DS_BADGE: Record<string, string> = {
  unassigned:       'bg-neutral-100 text-neutral-600',
  assigned:         'bg-blue-100 text-blue-700',
  accepted:         'bg-indigo-100 text-indigo-700',
  out_for_delivery: 'bg-amber-100 text-amber-700',
  delivered:        'bg-emerald-100 text-emerald-700',
  failed:           'bg-red-100 text-red-700',
  returned:         'bg-orange-100 text-orange-700',
};

type DeliveryManagementProps = {
  isAdmin?: boolean;
  permissions?: DeliveryAssignmentPermission[];
};

export default function DeliveryManagement({ isAdmin = false, permissions = [] }: DeliveryManagementProps) {
  const canAssign = isAdmin || permissions.includes('ASSIGN_DELIVERIES');
  const canReassign = isAdmin || permissions.includes('REASSIGN_DELIVERIES');
  const permissionKey = permissions.join(',');
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [dps, setDps] = useState<{id:string;fullName:string;phone?:string|null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPerson, setFilterPerson] = useState('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState<string|null>(null);
  const [assignPick, setAssignPick] = useState<Record<string,string>>({});
  const [historyOrderId, setHistoryOrderId] = useState<string|null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<Record<string,DeliveryAssignmentHistory[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string|null>(null);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [d, dp] = await Promise.all([
        listAllDeliveries(),
        canAssign ? listDeliveryPersons() : Promise.resolve([]),
      ]);
      setDeliveries(d); setDps(dp);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30000);
    return () => window.clearInterval(interval);
  }, [canAssign, permissionKey]);

  const toggleHistory = async (orderId: string) => {
    if (historyOrderId === orderId) {
      setHistoryOrderId(null);
      return;
    }
    setHistoryOrderId(orderId);
    if (assignmentHistory[orderId]) return;
    setHistoryLoading(orderId);
    try {
      const history = await getDeliveryAssignmentHistory(orderId);
      setAssignmentHistory(current => ({ ...current, [orderId]: history }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load assignment history.');
    } finally {
      setHistoryLoading(null);
    }
  };

  const handleAssign = async (orderId: string) => {
    const dpId = assignPick[orderId] || deliveries.find((delivery) => delivery.id === orderId)?.deliveryPersonId || '';
    if (!dpId) { setError('Select a delivery person first.'); return; }
    setAssigning(orderId); setError('');
    try {
      await assignDelivery(orderId, dpId);
      setNotice('Delivery person assigned successfully.');
      void load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to assign.'); }
    finally { setAssigning(null); }
  };

  const handleUnassign = async (orderId: string) => {
    setAssigning(orderId); setError(''); setNotice('');
    try {
      await unassignDelivery(orderId);
      setNotice('Delivery assignment removed.');
      void load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to remove assignment.'); }
    finally { setAssigning(null); }
  };

  const statuses = ['all', 'unassigned', 'assigned', 'accepted', 'out_for_delivery', 'delivered', 'failed', 'returned'];
  const visible = deliveries.filter((delivery) =>
    (filterStatus === 'all' || delivery.deliveryStatus === filterStatus)
    && (filterPerson === 'all' || delivery.deliveryPersonId === filterPerson),
  );
  const filterPeople = new Map<string,string>(dps.map((person)=>[person.id,person.fullName]));
  for(const delivery of deliveries){
    if(delivery.deliveryPersonId&&delivery.deliveryPersonName)
      filterPeople.set(delivery.deliveryPersonId,delivery.deliveryPersonName);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Delivery Management</h1>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={16} /> {notice}
          <button type="button" onClick={() => setNotice('')} className="ml-auto">×</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unassigned', key: 'unassigned', color: 'bg-neutral-50' },
          { label: 'In transit', key: 'out_for_delivery', color: 'bg-amber-50' },
          { label: 'Delivered', key: 'delivered', color: 'bg-emerald-50' },
          { label: 'Failed', key: 'failed', color: 'bg-red-50' },
        ].map(s => (
          <div key={s.key} className={`rounded-2xl border border-neutral-200 ${s.color} p-4`}>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{s.label}</p>
            <p className="mt-1 text-2xl font-black">{deliveries.filter(d => d.deliveryStatus === s.key).length}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(s => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${filterStatus === s ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}>
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <select value={filterPerson} onChange={(e)=>setFilterPerson(e.target.value)} aria-label="Filter by delivery person"
          className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700">
          <option value="all">All delivery persons</option>
          {Array.from(filterPeople,([id,fullName])=><option key={id} value={id}>{fullName}</option>)}
        </select>
      </div>

      {/* Delivery cards */}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : visible.length === 0 ? (
        <p className="text-sm text-neutral-500">No deliveries found.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(d => {
            const assignmentStates = ['unassigned','assigned','failed','returned'];
            const canChangeAssignment = canAssign && (!d.deliveryPersonId || canReassign);
            const isEligible = d.status === 'ready' && assignmentStates.includes(d.deliveryStatus);
            return (
              <div key={d.id} className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-sm">{d.orderNumber}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{d.customerName} · {d.phone}</p>
                  <p className="text-xs text-neutral-400">{d.deliveryAddress}</p>
                  <p className="mt-1 text-xs text-neutral-500">{d.status} · {d.paymentMethod} ({d.paymentStatus.replace(/_/g,' ')})</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${DS_BADGE[d.deliveryStatus] ?? 'bg-neutral-100'}`}>
                  {d.deliveryStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-neutral-600">
                <span>{new Date(d.createdAt).toLocaleString()} · {d.items.map((item)=>`${item.quantity} × ${item.name}`).join(', ')}</span>
                <span className="font-bold">ETB {Number(d.total).toLocaleString()}</span>
              </div>

              {d.deliveryPersonName && (
                <div className="flex items-center gap-2 text-xs text-neutral-600">
                  <User size={12} className="text-blue-500 shrink-0" />
                  <span className="font-semibold">{d.deliveryPersonName}</span>
                  {d.deliveryPersonPhone && <span>· {d.deliveryPersonPhone}</span>}
                  {d.assignedAt && <span>· Assigned {new Date(d.assignedAt).toLocaleDateString()}</span>}
                </div>
              )}

              {d.deliveryNote && (
                <p className="text-xs text-neutral-500 italic">"{d.deliveryNote}"</p>
              )}
              {d.failureReason && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Failure reason: {d.failureReason}</p>
              )}
              {d.customerConfirmationStatus === 'customer_confirmed' && (
                <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  <p className="font-bold">Delivery confirmation: customer confirmed receipt.</p>
                  {d.customerConfirmedAt && <p className="mt-1">Confirmed {new Date(d.customerConfirmedAt).toLocaleString()}</p>}
                </div>
              )}
              {d.customerConfirmationStatus === 'issue_reported' && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  <p className="font-bold">Delivery confirmation: customer reports the order was not received.</p>
                  {d.customerDeliveryIssueReportedAt && <p className="mt-1">Reported {new Date(d.customerDeliveryIssueReportedAt).toLocaleString()}</p>}
                  {d.customerDeliveryIssue && <p className="mt-1 whitespace-pre-wrap">{d.customerDeliveryIssue}</p>}
                </div>
              )}

              {/* Assign / reassign */}
              {isEligible && canChangeAssignment && dps.length > 0 && (
                <div className="border-t border-neutral-100 pt-3 flex flex-wrap gap-2 items-center">
                  <Truck size={14} className="text-neutral-400 shrink-0" />
                  <select
                    value={assignPick[d.id] ?? d.deliveryPersonId ?? ''}
                    onChange={e => setAssignPick(prev => ({...prev, [d.id]: e.target.value}))}
                    className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs outline-none focus:border-red-500"
                  >
                    <option value="">Select delivery person…</option>
                    {dps.map(dp => (
                      <option key={dp.id} value={dp.id}>{dp.fullName}</option>
                    ))}
                  </select>
                  <button type="button" disabled={!!assigning} onClick={() => handleAssign(d.id)}
                    className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50">
                    {assigning === d.id ? 'Assigning…' : d.deliveryPersonId ? 'Reassign' : 'Assign'}
                  </button>
                  {isAdmin && ['assigned','failed','returned'].includes(d.deliveryStatus) && (
                    <button type="button" disabled={!!assigning} onClick={() => handleUnassign(d.id)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                      Remove assignment
                    </button>
                  )}
                </div>
              )}
              {isEligible && d.deliveryPersonId && !canReassign && !isAdmin && (
                <p className="border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                  Reassignment permission is required to change this delivery person.
                </p>
              )}
              {d.deliveryStatus === 'unassigned' && d.status !== 'ready' && (
                <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-2">Assignment is available when order fulfillment marks this order ready.</p>
              )}
              {isEligible && canChangeAssignment && dps.length === 0 && (
                <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-2">No active delivery persons available. Create one in Staff Management.</p>
              )}
              {isAdmin && (
                <div className="border-t border-neutral-100 pt-2">
                  <button type="button" onClick={() => void toggleHistory(d.id)}
                    className="text-xs font-bold text-neutral-600 hover:text-red-700">
                    {historyOrderId === d.id ? 'Hide' : 'View'} assignment history
                  </button>
                  {historyOrderId === d.id && (
                    <div className="mt-2 space-y-2">
                      {historyLoading === d.id ? <p className="text-xs text-neutral-500">Loading assignment history…</p>
                        : (assignmentHistory[d.id]?.length ?? 0) === 0
                          ? <p className="text-xs text-neutral-500">No assignment history recorded.</p>
                          : assignmentHistory[d.id]?.map(event => (
                            <div key={event.id} className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                              <p className="font-bold">{event.actionType} · {new Date(event.createdAt).toLocaleString()}</p>
                              <p>By {event.assignedBy || 'Former staff member'} ({event.actorRole})</p>
                              {event.previousDeliveryPerson && <p>Previous: {event.previousDeliveryPerson}</p>}
                              {event.deliveryPerson && <p>Assigned to: {event.deliveryPerson}</p>}
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
