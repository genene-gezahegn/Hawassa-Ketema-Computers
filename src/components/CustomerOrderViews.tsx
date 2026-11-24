import React, { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  CreditCard,
  Download,
  MapPin,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  LoaderCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import { Product } from '../lib/inventory';
import ProductImage from './ProductImage';
import OrderCommunication from './OrderCommunication';
import {
  CartLine,
  CheckoutDetails,
  CustomerOrder,
  formatCustomerPrice,
  paymentBankOptions,
} from './customerStorefrontTypes';
import {
  apiRequest,
  getMyPaymentReceipt,
  getMyOrder,
  requestCancelOrder,
  requestReturnOrder,
  updateOrderAddress,
  getOrderReturn,
  OrderReturnRequest,
  respondToDeliveryConfirmation,
  uploadPaymentReceipt,
} from '../lib/api';

/* ─────────────────────────────────────────────────────────────
   SHARED STATUS HELPERS
───────────────────────────────────────────────────────────── */
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Preparing',
  ready: 'Ready for Delivery',
  out_for_delivery: 'Out for Delivery',
  completed: 'Delivered',
  cancelled: 'Cancelled',
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  pending:          'bg-neutral-100 text-neutral-700',
  confirmed:        'bg-blue-100 text-blue-700',
  processing:       'bg-amber-100 text-amber-700',
  ready:            'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-indigo-100 text-indigo-700',
  completed:        'bg-emerald-100 text-emerald-700',
  cancelled:        'bg-red-100 text-red-700',
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  unassigned:       'Awaiting assignment',
  assigned:         'Delivery assigned',
  accepted:         'Delivery accepted',
  out_for_delivery: 'Out for delivery',
  delivered:        'Delivered',
  failed:           'Delivery failed',
  returned:         'Returned to store',
};

const PAYMENT_BADGE: Record<string, string> = {
  unpaid:         'bg-neutral-100 text-neutral-600',
  pending:        'bg-amber-100 text-amber-700',
  pending_review: 'bg-amber-100 text-amber-700',
  verified:       'bg-emerald-100 text-emerald-700',
  paid:           'bg-emerald-100 text-emerald-700',
  rejected:       'bg-red-100 text-red-700',
  failed:         'bg-red-100 text-red-700',
  expired:        'bg-neutral-100 text-neutral-600',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  pending: 'Payment Pending',
  pending_review: 'Pending Verification',
  verified: 'Paid',
  paid: 'Paid',
  rejected: 'Payment Failed',
  failed: 'Payment Failed',
  expired: 'Payment Link Expired',
};

function BankAccountNumber({ accountNumber, fallback }: { accountNumber: string; fallback: string }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [additionalCopyStatus, setAdditionalCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copyAccountNumber = async () => {
    setCopyStatus('idle');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText(accountNumber);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  const copyAdditionalAccountNumber = async () => {
    setAdditionalCopyStatus('idle');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText('0930407122');
      setAdditionalCopyStatus('copied');
    } catch {
      setAdditionalCopyStatus('error');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="break-all"><strong>Account number:</strong> {accountNumber || fallback}</p>
        {accountNumber && (
          <button type="button" onClick={() => void copyAccountNumber()} aria-label="Copy account number"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-xs font-bold text-blue-900 hover:bg-blue-100">
            {copyStatus === 'copied' ? <CheckCircle2 size={13} /> : <ClipboardCopy size={13} />}
            {copyStatus === 'copied' ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <p><strong>Bank:</strong> Telebirr</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p><strong>Account number:</strong> 0930407122</p>
        <button type="button" onClick={() => void copyAdditionalAccountNumber()} aria-label="Copy additional account number"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-xs font-bold text-blue-900 hover:bg-blue-100">
          {additionalCopyStatus === 'copied' ? <CheckCircle2 size={13} /> : <ClipboardCopy size={13} />}
          {additionalCopyStatus === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      {copyStatus === 'error' && (
        <p role="alert" className="text-xs text-red-700">Could not copy the account number. Please copy it manually.</p>
      )}
      {additionalCopyStatus === 'error' && (
        <p role="alert" className="text-xs text-red-700">Could not copy the additional account number. Please copy it manually.</p>
      )}
    </>
  );
}

function StatusBadge({ status, map = ORDER_STATUS_BADGE }: { status: string; map?: Record<string, string> }) {
  const cls = map[status] ?? 'bg-neutral-100 text-neutral-600';
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>
      {ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   ORDER TIMELINE
───────────────────────────────────────────────────────────── */
const TIMELINE_STEPS = [
  { key: 'pending',          label: 'Order Placed' },
  { key: 'confirmed',        label: 'Confirmed' },
  { key: 'processing',       label: 'Preparing' },
  { key: 'ready',            label: 'Ready for Delivery' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'completed',        label: 'Delivered' },
];

const STATUS_RANK: Record<string, number> = {
  pending: 0, confirmed: 1, processing: 2, ready: 3, out_for_delivery: 4, completed: 5,
};

function OrderTimeline({ order }: { order: CustomerOrder }) {
  if (order.status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <X size={18} className="text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-800">Order Cancelled</p>
          {order.cancellationStatus && (
            <p className="text-xs text-red-600 mt-0.5">Cancellation {order.cancellationStatus}</p>
          )}
        </div>
      </div>
    );
  }

  const rank = order.deliveryStatus === 'out_for_delivery'
    ? STATUS_RANK.out_for_delivery
    : order.deliveryStatus === 'delivered'
      ? STATUS_RANK.completed
      : STATUS_RANK[order.status] ?? 0;

  return (
    <div className="relative">
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-neutral-200" aria-hidden="true" />
      <ol className="space-y-4 relative">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < rank;
          const active = i === rank;
          return (
            <li key={step.key} className="flex items-center gap-4 pl-0">
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black
                ${done ? 'border-emerald-500 bg-emerald-500 text-white'
                  : active ? 'border-red-600 bg-red-600 text-white'
                  : 'border-neutral-300 bg-white text-neutral-400'}`}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <div>
                <p className={`text-sm font-bold ${active ? 'text-neutral-900' : done ? 'text-emerald-700' : 'text-neutral-400'}`}>
                  {step.label}
                </p>
                {step.key === 'out_for_delivery' && order.deliveryPersonName && active && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {order.deliveryPersonName}
                    {order.deliveryPersonPhone && (
                      <a href={`tel:${order.deliveryPersonPhone}`} className="ml-2 text-blue-600 hover:underline">
                        {order.deliveryPersonPhone}
                      </a>
                    )}
                  </p>
                )}
                {step.key === 'completed' && order.deliveredAt && done && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {new Date(order.deliveredAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ORDER DETAIL MODAL / PAGE
───────────────────────────────────────────────────────────── */
interface OrderDetailProps {
  orderId: string;
  onBack: () => void;
  onOrderUpdated: () => void;
}

function OrderDetail({ orderId, onBack, onOrderUpdated }: OrderDetailProps) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [returnRequest, setReturnRequest] = useState<OrderReturnRequest|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deliveryIssue, setDeliveryIssue] = useState('');
  const [showDeliveryIssueForm, setShowDeliveryIssueForm] = useState(false);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [receiptNotice, setReceiptNotice] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentBank, setPaymentBank] = useState('cbe');
  const [paymentReference, setPaymentReference] = useState('');
  const [senderName, setSenderName] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState({
    bankName: 'Bank transfer',
    accountName: 'Store account',
    accountNumber: '',
    instructions: 'Transfer the exact order total and submit your transaction reference.',
  });

  /* Cancel dialog */
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  /* Return dialog */
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('defective');
  const [returnDesc, setReturnDesc] = useState('');
  const [returnBusy, setReturnBusy] = useState(false);

  /* Address edit */
  const [showAddressEdit, setShowAddressEdit] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addressBusy, setAddressBusy] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [o, r] = await Promise.all([getMyOrder(orderId), getOrderReturn(orderId)]);
      setOrder(o);
      setNewAddress(o.address);
      setNewPhone(o.phone);
      setPaymentReference(o.bankTransactionReference || '');
      if (o.receiptBank) setPaymentBank(o.receiptBank);
      setReturnRequest(r.returnRequest);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [orderId]);

  useEffect(() => {
    apiRequest<typeof paymentInstructions>('/payments/instructions')
      .then(setPaymentInstructions)
      .catch(() => setReceiptError('Payment instructions are temporarily unavailable. Please contact the store.'));
  }, []);

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    setCancelBusy(true);
    try {
      const result = await requestCancelOrder(orderId, cancelReason);
      setNotice((result as any).message);
      setShowCancel(false);
      setCancelReason('');
      void load();
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit cancellation.');
    } finally { setCancelBusy(false); }
  };

  const handleReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setReturnBusy(true);
    try {
      const result = await requestReturnOrder(orderId, {
        items: order.items.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity, reason: returnReason })),
        reason: returnReason,
        description: returnDesc,
      });
      setNotice((result as any).message);
      setShowReturn(false);
      void load();
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit return request.');
    } finally { setReturnBusy(false); }
  };

  const handleReceiptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setReceiptBusy(true);
    setReceiptError('');
    setReceiptNotice('');
    try {
      const result = await uploadPaymentReceipt(orderId, {
        bank: paymentBank,
        reference: paymentReference.trim(),
        senderName,
        receipt: receiptFile,
      });
      setReceiptNotice(result.message);
      setReceiptFile(null);
      setSenderName('');
      await load();
      onOrderUpdated();
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Unable to submit your receipt.');
    } finally {
      setReceiptBusy(false);
    }
  };

  const handleReceiptOpen = async () => {
    try {
      const blob = await getMyPaymentReceipt(orderId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Unable to open the submitted receipt.');
    }
  };

  const handleAddressUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setAddressBusy(true);
    try {
      await updateOrderAddress(orderId, { deliveryAddress: newAddress, phone: newPhone });
      setNotice('Delivery details updated.');
      setShowAddressEdit(false);
      void load();
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update.');
    } finally { setAddressBusy(false); }
  };

  const handleDeliveryConfirmation = async (
    response: 'received' | 'not_received',
    details?: string,
  ) => {
    setConfirmationBusy(true);
    setError('');
    try {
      const result = await respondToDeliveryConfirmation(
        orderId,
        response === 'received' ? { response } : { response, details: details || '' },
      );
      setNotice(result.message);
      setShowDeliveryIssueForm(false);
      setDeliveryIssue('');
      await load();
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your delivery response.');
    } finally {
      setConfirmationBusy(false);
    }
  };

  const handleDeliveryIssue = async (e: FormEvent) => {
    e.preventDefault();
    await handleDeliveryConfirmation('not_received', deliveryIssue);
  };

  const printOrder = () => window.print();

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw size={24} className="animate-spin text-neutral-400" />
    </div>
  );

  if (!order) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'Order not found.'}</div>
  );

  const canCancel = ['pending', 'confirmed'].includes(order.status) && !order.cancellationStatus;
  const canReturn = order.status === 'completed' && !returnRequest;
  const canEditAddress = ['pending', 'confirmed'].includes(order.status);
  const canSubmitReceipt = ['unpaid', 'pending', 'rejected'].includes(order.paymentStatus ?? 'unpaid')
    || order.paymentStatus === 'pending_review' && !order.receiptPaymentId;
  const receiptFileRequired = order.paymentStatus === 'pending_review' && !order.receiptPaymentId;

  const inputCls = 'mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100';

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Back + header */}
      <div className="flex items-center gap-3 print:hidden">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
          <ArrowLeft size={16} /> Back to orders
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={16} /> {notice}
          <button type="button" onClick={() => setNotice('')} className="ml-auto print:hidden">×</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Left column */}
        <div className="space-y-5">
          {/* Order summary card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase text-neutral-500">Order</p>
                <h2 className="text-xl font-black tracking-tight">{order.orderNumber || order.id}</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {new Date(order.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center print:hidden">
                <StatusBadge status={order.status} />
                {order.deliveryStatus && order.deliveryStatus !== 'unassigned' && (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                    {DELIVERY_STATUS_LABELS[order.deliveryStatus] ?? order.deliveryStatus.replace(/_/g,' ')}
                  </span>
                )}
                {order.cancellationStatus === 'requested' && (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                    Cancellation Requested
                  </span>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="border-t border-neutral-100 pt-4 space-y-3">
              {order.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-black text-neutral-500">
                    {item.quantity}×
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{item.name}</p>
                    <p className="text-xs text-neutral-500">{item.sku}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{formatCustomerPrice(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-neutral-100 mt-4 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span><span>{formatCustomerPrice(order.total)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Delivery fee</span><span>{formatCustomerPrice(0)} (free)</span>
              </div>
              <div className="flex justify-between font-black text-base">
                <span>Total</span><span>{formatCustomerPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery details */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold">Delivery information</h3>
              {canEditAddress && (
                <button type="button" onClick={() => setShowAddressEdit(v => !v)}
                  className="text-xs font-bold text-red-700 hover:underline print:hidden">
                  {showAddressEdit ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
            {showAddressEdit ? (
              <form onSubmit={handleAddressUpdate} className="space-y-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Delivery address
                  <textarea rows={2} value={newAddress} onChange={e => setNewAddress(e.target.value)} required minLength={5} className={inputCls} />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Phone
                  <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} required className={inputCls} />
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={addressBusy} className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-60">
                    {addressBusy ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" onClick={() => setShowAddressEdit(false)} className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-neutral-700">
                  <span className="text-xs font-bold uppercase text-neutral-500">Customer</span>
                  <span>{order.customerName}</span>
                </div>
                <div className="flex items-start gap-2 text-neutral-700">
                  <MapPin size={14} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{order.address}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-700">
                  <Phone size={14} className="shrink-0 text-red-500" />
                  <a href={`tel:${order.phone}`} className="hover:underline">{order.phone}</a>
                </div>
                {order.email && (
                  <div className="flex items-center gap-2 text-neutral-700">
                    <Mail size={14} className="shrink-0 text-red-500" />
                    <a href={`mailto:${order.email}`} className="break-all hover:underline">{order.email}</a>
                  </div>
                )}
              </div>
            )}

            {/* Delivery person */}
            {order.deliveryPersonName && (
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <p className="text-xs font-bold uppercase text-neutral-500 mb-2">Assigned delivery person</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-sm font-black text-neutral-600">
                    {order.deliveryPersonName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{order.deliveryPersonName}</p>
                    {order.deliveryPersonPhone && (
                      <a href={`tel:${order.deliveryPersonPhone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Phone size={11} /> {order.deliveryPersonPhone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {order.deliveryNote && (
              <p className="mt-3 text-xs text-neutral-500 italic border-t border-neutral-100 pt-3">
                Note: {order.deliveryNote}
              </p>
            )}
            {order.failureReason && (
              <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                Delivery attempt issue: {order.failureReason}
              </p>
            )}
          </div>

          {order.deliveryStatus === 'delivered' && order.customerConfirmationStatus && (
            <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm" aria-labelledby="delivery-confirmation-heading">
              <p className="text-xs font-bold uppercase tracking-wide text-red-700">Delivery confirmation</p>
              <h3 id="delivery-confirmation-heading" className="mt-1 text-lg font-extrabold">Order {order.orderNumber || order.id}</h3>
              {order.deliveredAt && (
                <p className="mt-1 text-sm text-neutral-500">
                  Marked delivered {new Date(order.deliveredAt).toLocaleString()}
                </p>
              )}

              {order.customerConfirmationStatus === 'awaiting_confirmation' && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-neutral-800">
                    Your order has been marked as delivered. Did you receive your order?
                  </p>
                  {!showDeliveryIssueForm ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button type="button" disabled={confirmationBusy}
                        onClick={() => void handleDeliveryConfirmation('received')}
                        className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
                        {confirmationBusy ? 'Submitting…' : 'Yes, I received my order'}
                      </button>
                      <button type="button" disabled={confirmationBusy}
                        onClick={() => setShowDeliveryIssueForm(true)}
                        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                        I have not received my order
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleDeliveryIssue} className="mt-3 space-y-3">
                      <label className="block text-sm font-semibold text-neutral-700">
                        Tell us what happened
                        <textarea value={deliveryIssue} onChange={e => setDeliveryIssue(e.target.value)}
                          required minLength={5} maxLength={2000} rows={4}
                          className={`${inputCls} resize-y`}
                          placeholder="Describe the delivery problem…" />
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="submit" disabled={confirmationBusy || deliveryIssue.trim().length < 5}
                          className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
                          {confirmationBusy ? 'Submitting…' : 'Submit delivery concern'}
                        </button>
                        <button type="button" disabled={confirmationBusy}
                          onClick={() => setShowDeliveryIssueForm(false)}
                          className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-60">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {order.customerConfirmationStatus === 'customer_confirmed' && (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  Receipt confirmed. Thank you for shopping with Hawassa-Ketema Computers.
                  {order.customerConfirmedAt && (
                    <span className="mt-1 block text-xs font-medium">
                      Confirmed {new Date(order.customerConfirmedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              )}

              {order.customerConfirmationStatus === 'issue_reported' && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="status">
                  <p className="font-semibold">Your delivery concern has been submitted. Our team will review your report.</p>
                  {order.customerDeliveryIssue && <p className="mt-2 whitespace-pre-wrap">{order.customerDeliveryIssue}</p>}
                  {order.customerDeliveryIssueReportedAt && (
                    <p className="mt-2 text-xs">Submitted {new Date(order.customerDeliveryIssueReportedAt).toLocaleString()}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Payment */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-extrabold">Payment</h3>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">{order.paymentMethod}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PAYMENT_BADGE[order.paymentStatus ?? 'unpaid'] ?? 'bg-neutral-100'}`}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus ?? 'unpaid'] ?? (order.paymentStatus ?? 'unpaid').replace(/_/g, ' ')}
              </span>
            </div>
            {order.paymentMethod === 'Bank transfer' && (
              <div className="mt-3 space-y-3 text-sm text-neutral-600">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p><strong>Bank:</strong> {paymentInstructions.bankName}</p>
                  <p><strong>Account name:</strong> {paymentInstructions.accountName}</p>
                  <BankAccountNumber accountNumber={paymentInstructions.accountNumber} fallback="Store account is not configured" />
                  <p className="mt-2 text-xs">{paymentInstructions.instructions}</p>
                  <p className="mt-2 font-bold text-neutral-900">Exact amount due: {formatCustomerPrice(order.total)}</p>
                </div>
                {order.receiptSubmittedAt && (
                  <p className="text-xs">
                    Submitted {new Date(order.receiptSubmittedAt).toLocaleString()}
                    {order.receiptBank ? ` · ${order.receiptBank}` : ''}
                    {order.bankTransactionReference ? ` · Ref ${order.bankTransactionReference}` : ''}
                  </p>
                )}
                {order.receiptPaymentId && (
                  <button type="button" onClick={() => void handleReceiptOpen()}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
                    View submitted receipt
                  </button>
                )}
                {order.receiptReviewNote && (
                  <p className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800">
                    Staff review: {order.receiptReviewNote}
                  </p>
                )}
                {order.paymentStatus === 'pending_review' && (
                  <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                    {order.receiptPaymentId
                      ? 'Your receipt is awaiting staff verification. You can replace it if the store rejects it.'
                      : 'Your transaction reference is saved. Add a receipt file below for staff review.'}
                  </p>
                )}
                {canSubmitReceipt && (
                  <form onSubmit={handleReceiptSubmit} className="space-y-3 rounded-xl border border-neutral-200 p-3">
                    <p className="font-bold text-neutral-900">
                      {order.paymentStatus === 'rejected'
                        ? 'Replace rejected receipt'
                        : order.paymentStatus === 'pending_review' ? 'Add your transfer receipt' : 'Submit your transfer receipt'}
                    </p>
                    <label className="block text-xs font-semibold text-neutral-700">
                      Bank or wallet
                      <select value={paymentBank} onChange={e => setPaymentBank(e.target.value)} className={inputCls}>
                        {paymentBankOptions.map(bank => <option key={bank.value} value={bank.value}>{bank.label}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-neutral-700">
                      Transaction reference
                      <input required minLength={5} maxLength={180} value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className={inputCls} />
                    </label>
                    <label className="block text-xs font-semibold text-neutral-700">
                      Sender name
                      <input maxLength={120} value={senderName} onChange={e => setSenderName(e.target.value)} className={inputCls} />
                    </label>
                    <label className="block text-xs font-semibold text-neutral-700">
                      Receipt image or PDF (JPG, PNG, WebP, PDF; max 5 MB)
                      <input type="file" required={receiptFileRequired} accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
                    </label>
                    <button type="submit" disabled={receiptBusy || paymentReference.trim().length < 5 || receiptFileRequired && !receiptFile}
                      className="w-full rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                      {receiptBusy ? 'Submitting receipt…' : 'Submit for verification'}
                    </button>
                  </form>
                )}
                {receiptError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{receiptError}</p>}
                {receiptNotice && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{receiptNotice}</p>}
              </div>
            )}
            {order.paymentMethod === 'Payo' && order.paymentStatus !== 'paid' && (
              <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                This legacy payment method is no longer available. Contact the store to arrange payment for this order.
              </p>
            )}
          </div>

          <OrderCommunication orderId={order.id} />

          {/* Return request status */}
          {returnRequest && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <h3 className="font-extrabold mb-2 text-orange-800">Return Request</h3>
              <div className="text-sm text-orange-700 space-y-1">
                <p>Status: <strong>{returnRequest.status.replace(/_/g,' ')}</strong></p>
                <p>Reason: {returnRequest.reason.replace(/_/g,' ')}</p>
                {returnRequest.description && <p>{returnRequest.description}</p>}
                {returnRequest.adminNote && (
                  <p className="text-orange-900 font-semibold">Store note: {returnRequest.adminNote}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column — timeline + actions */}
        <div className="space-y-4">
          {/* Timeline */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h3 className="font-extrabold mb-4">Order progress</h3>
            <OrderTimeline order={order} />
          </div>

          {/* Action buttons */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-2 print:hidden">
            <h3 className="font-extrabold mb-3">Actions</h3>

            <button type="button" onClick={printOrder}
              className="flex w-full items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
              <Download size={15} /> Print / save receipt
            </button>

            {canEditAddress && (
              <button type="button" onClick={() => setShowAddressEdit(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
                <MapPin size={15} /> Update delivery address
              </button>
            )}

            {canCancel && (
              <button type="button" onClick={() => setShowCancel(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                <X size={15} /> Request cancellation
              </button>
            )}

            {order.cancellationStatus === 'requested' && (
              <p className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-2.5 text-xs text-orange-700 font-semibold">
                Cancellation request is pending review.
              </p>
            )}

            {canReturn && (
              <button type="button" onClick={() => setShowReturn(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-orange-200 px-4 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50">
                <RotateCcw size={15} /> Request return
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel dialog */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black mb-1">Request cancellation</h3>
            <p className="text-sm text-neutral-500 mb-4">The store will review your request. Your order remains active until approved.</p>
            <form onSubmit={handleCancel} className="space-y-4">
              <label className="block text-sm font-semibold">
                Reason for cancellation *
                <textarea required minLength={2} rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  className={inputCls + ' mt-1'} placeholder="Please tell us why you want to cancel…" />
              </label>
              <div className="flex gap-3">
                <button type="submit" disabled={cancelBusy}
                  className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
                  {cancelBusy ? 'Submitting…' : 'Submit request'}
                </button>
                <button type="button" onClick={() => setShowCancel(false)}
                  className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-semibold text-neutral-600">
                  Keep order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return dialog */}
      {showReturn && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black mb-1">Request a return</h3>
            <p className="text-sm text-neutral-500 mb-4">Select a reason and describe the issue. The store will review your return request.</p>
            <form onSubmit={handleReturn} className="space-y-4">
              <label className="block text-sm font-semibold">
                Return reason *
                <select value={returnReason} onChange={e => setReturnReason(e.target.value)} className={inputCls + ' mt-1'}>
                  <option value="defective">Product is defective / not working</option>
                  <option value="wrong_item">Wrong item received</option>
                  <option value="damaged_in_transit">Damaged during delivery</option>
                  <option value="changed_mind">Changed my mind</option>
                  <option value="other">Other reason</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Description
                <textarea rows={3} value={returnDesc} onChange={e => setReturnDesc(e.target.value)}
                  className={inputCls + ' mt-1'} placeholder="Describe the issue (optional)…" />
              </label>
              <div className="flex gap-3">
                <button type="submit" disabled={returnBusy}
                  className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
                  {returnBusy ? 'Submitting…' : 'Submit return request'}
                </button>
                <button type="button" onClick={() => setShowReturn(false)}
                  className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-semibold text-neutral-600">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER DASHBOARD OVERVIEW (new 'home' tab)
───────────────────────────────────────────────────────────── */
interface CustomerDashboardOverviewProps {
  orders: CustomerOrder[];
  customerName: string;
  onViewOrders: () => void;
  onViewOrder: (id: string) => void;
  onBrowseCatalog: () => void;
}

export function CustomerDashboardOverview({
  orders,
  customerName,
  onViewOrders,
  onViewOrder,
  onBrowseCatalog,
}: CustomerDashboardOverviewProps) {
  const total = orders.length;
  const active = orders.filter(o => !['completed','cancelled'].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === 'completed').length;
  const pendingPayment = orders.filter(o =>
    o.paymentStatus === 'pending_review'
    || o.paymentStatus === 'pending'
    || o.paymentStatus === 'unpaid' && o.paymentMethod === 'Bank transfer'
  ).length;
  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <p className="text-xs font-bold uppercase text-red-700">Customer portal</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
          Welcome back, {customerName.split(' ')[0]}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: total, color: 'bg-neutral-50 border-neutral-200' },
          { label: 'Active Orders', value: active, color: 'bg-blue-50 border-blue-200' },
          { label: 'Delivered', value: delivered, color: 'bg-emerald-50 border-emerald-200' },
          { label: 'Pending Payment', value: pendingPayment, color: 'bg-amber-50 border-amber-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{s.label}</p>
            <p className="mt-1 text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="font-extrabold">Recent Orders</h2>
          <button type="button" onClick={onViewOrders} className="text-xs font-bold text-red-700 hover:underline">
            View all
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center">
            <PackageCheck size={28} className="mx-auto mb-3 text-neutral-300" />
            <p className="text-sm text-neutral-500">No orders yet.</p>
            <button type="button" onClick={onBrowseCatalog} className="mt-3 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white">
              Browse catalog
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {recent.map(o => (
              <button key={o.id} type="button" onClick={() => onViewOrder(o.id)}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-neutral-50 transition">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{o.orderNumber || o.id}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {new Date(o.createdAt).toLocaleDateString()} ·{' '}
                    {o.items.length} item{o.items.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <StatusBadge status={o.status} />
                  <span className="text-xs font-bold text-neutral-600">{formatCustomerPrice(o.total)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'My Orders', desc: 'View and manage all your orders', icon: PackageCheck, action: onViewOrders },
          { label: 'Browse Catalog', desc: 'Find computers and accessories', icon: ShoppingBag, action: onBrowseCatalog },
          { label: 'Help & Support', desc: 'Contact us at genenedev@gmail.com', icon: Phone, action: () => window.open('mailto:genenedev@gmail.com') },
        ].map(q => (
          <button key={q.label} type="button" onClick={q.action}
            className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-400 transition">
            <q.icon size={20} className="shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-bold text-sm">{q.label}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{q.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER ORDERS LIST (enhanced)
───────────────────────────────────────────────────────────── */
interface CustomerOrdersProps {
  orders: CustomerOrder[];
  email: string;
  onBrowseCatalog: () => void;
  onOrdersRefresh?: () => void;
}

export function CustomerOrders({ orders, email, onBrowseCatalog, onOrdersRefresh }: CustomerOrdersProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  if (selectedOrderId) {
    return (
      <OrderDetail
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
        onOrderUpdated={() => { onOrdersRefresh?.(); }}
      />
    );
  }

  const statuses = ['all', 'pending', 'confirmed', 'processing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];

  const filtered = orders
    .filter(o => {
      const matchSearch = !search || (o.orderNumber ?? o.id).toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (statusFilter === 'out_for_delivery'
        ? o.deliveryStatus === 'out_for_delivery' || o.status === 'out_for_delivery'
        : o.status === statusFilter);
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortDir === 'desc' ? diff : -diff;
    });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-red-700">Customer account</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black">My Orders</h1>
          <p className="mt-0.5 text-sm text-neutral-500">{email}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm text-neutral-500 focus-within:border-red-500 w-52">
          <Search size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order number…"
            className="bg-transparent outline-none flex-1 text-neutral-800 placeholder:text-neutral-400 text-xs" />
        </label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 outline-none focus:border-red-500">
          {statuses.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : ORDER_STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
        <button type="button" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 hover:border-neutral-400">
          {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
          <PackageCheck className="mx-auto text-neutral-300 mb-3" size={34} />
          <p className="font-bold">{orders.length === 0 ? 'No orders yet' : 'No matching orders'}</p>
          <p className="mt-1 text-sm text-neutral-500">{orders.length === 0 ? 'Your orders will appear here.' : 'Try adjusting filters.'}</p>
          {orders.length === 0 && (
            <button type="button" onClick={onBrowseCatalog} className="mt-4 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white">
              Browse catalog
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <article key={order.id}
              className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 hover:border-neutral-400 transition cursor-pointer"
              onClick={() => setSelectedOrderId(order.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setSelectedOrderId(order.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-extrabold">{order.orderNumber || order.id}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <StatusBadge status={order.status} />
                  {order.cancellationStatus === 'requested' && (
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                      Cancellation Requested
                    </span>
                  )}
                  {order.deliveryStatus && order.deliveryStatus !== 'unassigned' && (
                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                      {DELIVERY_STATUS_LABELS[order.deliveryStatus] ?? order.deliveryStatus.replace(/_/g,' ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-3 pb-2 text-sm space-y-1 text-neutral-600">
                {order.items.slice(0, 3).map((item) => (
                  <p key={item.productId}>{item.quantity} × {item.name}</p>
                ))}
                {order.items.length > 3 && (
                  <p className="text-xs text-neutral-400">+{order.items.length - 3} more items</p>
                )}
              </div>

              <div className="flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-3 text-sm">
                <span className="text-neutral-500">
                  {order.paymentMethod}
                  {order.paymentStatus && order.paymentStatus !== 'unpaid' && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${PAYMENT_BADGE[order.paymentStatus] ?? ''}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus.replace(/_/g,' ')}
                    </span>
                  )}
                </span>
                <strong>{formatCustomerPrice(order.total)}</strong>
              </div>

              <p className="mt-2 text-xs font-bold text-red-700">View details →</p>
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-neutral-500">Showing {filtered.length} of {orders.length} orders.</p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   CHECKOUT (unchanged, re-exported)
───────────────────────────────────────────────────────────── */
interface CustomerCheckoutProps {
  cartLines: CartLine[];
  cartTotal: number;
  checkout: CheckoutDetails;
  onCheckoutChange: (updates: Partial<CheckoutDetails>) => void;
  onUpdateCart: (product: Product, change: number) => void;
  onPlaceOrder: (event: FormEvent) => void;
  placingOrder: boolean;
  onBrowseCatalog: () => void;
  paymentInstructions: {bankName:string;accountName:string;accountNumber:string;instructions:string};
}

export function CustomerCheckout({
  cartLines, cartTotal, checkout, onCheckoutChange, onUpdateCart, onPlaceOrder, placingOrder, onBrowseCatalog,
  paymentInstructions,
}: CustomerCheckoutProps) {
  return (
    <section>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase text-red-700">Your selection</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black">Cart & checkout</h1>
      </div>
      {cartLines.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center">
          <ShoppingBag className="mx-auto text-neutral-400" size={32} />
          <h2 className="mt-3 font-bold">Your cart is empty</h2>
          <button type="button" onClick={onBrowseCatalog} className="mt-4 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white">Browse catalog</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
          <div className="space-y-3">
            {cartLines.map(({ product, quantity }) => (
              <div key={product.id} className="bg-white border border-neutral-200 rounded-2xl p-3 flex gap-4 items-center">
                <div className="w-24 h-20 rounded-xl overflow-hidden bg-neutral-100 shrink-0"><ProductImage product={product} /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold truncate">{product.name}</h2>
                  <p className="text-sm text-neutral-600">{formatCustomerPrice(product.price)} · {product.stockQuantity} available</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onUpdateCart(product, -1)} className="h-9 w-9 rounded-xl border border-neutral-300 flex items-center justify-center"><Minus size={16} /></button>
                  <span className="w-5 text-center font-bold">{quantity}</span>
                  <button type="button" onClick={() => onUpdateCart(product, 1)} disabled={quantity >= product.stockQuantity} className="h-9 w-9 rounded-xl border border-neutral-300 flex items-center justify-center disabled:opacity-40"><Plus size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onPlaceOrder} className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-extrabold text-lg">Delivery details</h2>
            <label className="block text-xs font-semibold text-neutral-600">Full name<input required value={checkout.name} onChange={e => onCheckoutChange({name:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900" /></label>
            <label className="block text-xs font-semibold text-neutral-600">Email<input required type="email" value={checkout.email} onChange={e => onCheckoutChange({email:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900" /></label>
            <label className="block text-xs font-semibold text-neutral-600">Phone<input required type="tel" value={checkout.phone} onChange={e => onCheckoutChange({phone:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900" /></label>
            <label className="block text-xs font-semibold text-neutral-600">Delivery address<textarea required rows={2} value={checkout.address} onChange={e => onCheckoutChange({address:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900" /></label>
            <label className="block text-xs font-semibold text-neutral-600">Payment method<select value={checkout.paymentMethod} onChange={e => onCheckoutChange({paymentMethod:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"><option>Cash on delivery</option><option>Bank transfer</option><option>Pay on pickup</option></select></label>
            {checkout.paymentMethod==='Bank transfer' && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2 text-sm">
              <p className="font-extrabold text-blue-950">Transfer payment details</p>
              <p><strong>Bank:</strong> {paymentInstructions.bankName}</p><p><strong>Account name:</strong> {paymentInstructions.accountName}</p><BankAccountNumber accountNumber={paymentInstructions.accountNumber} fallback="Store has not configured its account yet" /><p className="text-xs text-blue-900">{paymentInstructions.instructions}</p>
              <p className="font-bold text-blue-950">Exact amount due: {formatCustomerPrice(cartTotal)}</p>
              <p className="text-xs text-blue-900">Transfer the exact order amount, then enter your transaction details below.</p>
              <label className="block text-xs font-semibold text-blue-950">Bank or wallet
                <select required value={checkout.bank} onChange={e => onCheckoutChange({bank:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900">
                  {paymentBankOptions.map(bank => <option key={bank.value} value={bank.value}>{bank.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-blue-950">Bank transaction reference
                <input required minLength={5} maxLength={180} value={checkout.bankTransactionReference} onChange={e => onCheckoutChange({bankTransactionReference:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900" />
              </label>
              <label className="block text-xs font-semibold text-blue-950">Sender name
                <input maxLength={120} value={checkout.senderName} onChange={e => onCheckoutChange({senderName:e.target.value})} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900" />
              </label>
              <label className="block text-xs font-semibold text-blue-950">Receipt image (JPG, PNG, WebP, PDF; max 5 MB)
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => onCheckoutChange({receiptFile:e.target.files?.[0] || null})} className="mt-1 block w-full text-xs text-neutral-900" />
              </label>
            </div>}
            <div className="border-t border-neutral-200 pt-3 flex justify-between font-black"><span>Order total</span><span>{formatCustomerPrice(cartTotal)}</span></div>
            <button type="submit" disabled={placingOrder} className="w-full rounded-xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2">{placingOrder?<><LoaderCircle size={17} className="animate-spin" /> Placing order...</>:<><CreditCard size={17} /> Place order</>}</button>
          </form>
        </div>
      )}
    </section>
  );
}
