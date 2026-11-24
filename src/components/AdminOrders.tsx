import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShoppingBag } from 'lucide-react';
import { apiRequest, getPaymentReceiptImage } from '../lib/api';

type Payment = {
  id: string;
  orderId: string;
  orderNumber: string;
  bank: string;
  reference: string;
  senderName: string;
  status: string;
  createdAt: string;
  amount: number;
  customerName: string;
  email: string;
  reviewNote: string;
  hasReceipt: boolean;
  items: Array<{ name: string; quantity: number }>;
};

type ConfirmationStatus = 'awaiting_confirmation' | 'customer_confirmed' | 'issue_reported';
type ConfirmationFilter = 'all' | ConfirmationStatus;
type OrderPaymentFilter = 'all' | 'pending' | 'paid' | 'failed' | 'rejected' | 'expired' | 'cash_on_delivery';
type PayoPayment = {
  id: string;
  orderId: string;
  orderNumber: string;
  payoOrderId: string | null;
  paymentReference: string;
  amount: number;
  currency: string;
  status: string;
  transactionReference: string | null;
  senderName: string;
  initializationError: string | null;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
  customerName: string;
  email: string;
};
type PaymentReviewHistory = {
  id: string;
  orderId: string;
  orderNumber: string;
  reference: string;
  amount: number;
  action: 'approved' | 'rejected';
  note: string;
  reviewerName: string | null;
  reviewedAt: string;
};
type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  paymentMethod: string;
  status: string;
  total: number;
  createdAt: string;
  deliveryStatus?: string | null;
  deliveryPersonName?: string | null;
  deliveredAt?: string | null;
  customerConfirmationStatus?: ConfirmationStatus | null;
  customerConfirmedAt?: string | null;
  customerDeliveryIssue?: string;
  customerDeliveryIssueReportedAt?: string | null;
  paymentStatus?: string;
  items: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number }>;
};

const statuses = ['confirmed', 'processing', 'ready', 'completed', 'cancelled'];
const confirmationLabels: Record<ConfirmationStatus, string> = {
  awaiting_confirmation: 'Awaiting customer confirmation',
  customer_confirmed: 'Customer confirmed',
  issue_reported: 'Issue reported',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payoPayments, setPayoPayments] = useState<PayoPayment[]>([]);
  const [reviewHistory, setReviewHistory] = useState<PaymentReviewHistory[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmationFilter, setConfirmationFilter] = useState<ConfirmationFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentFilter>('all');
  const [payoStatusFilter, setPayoStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed' | 'rejected' | 'expired'>('all');

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [data, paymentData, payoPaymentData, historyData] = await Promise.all([
        apiRequest<{ orders: Order[] }>('/orders'),
        apiRequest<{ payments: Payment[] }>('/payments/admin/pending'),
        apiRequest<{ payments: PayoPayment[] }>('/payments/admin/legacy-payo'),
        apiRequest<{ history: PaymentReviewHistory[] }>('/payments/admin/review-history'),
      ]);
      setOrders(data.orders);
      setPayments(paymentData.payments);
      setPayoPayments(payoPaymentData.payments);
      setReviewHistory(historyData.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter(order => {
      const matchesConfirmation = confirmationFilter === 'all'
        || order.customerConfirmationStatus === confirmationFilter;
      const matchesPayment = paymentFilter === 'all'
        || (paymentFilter === 'cash_on_delivery' && order.paymentMethod === 'Cash on delivery')
        || (paymentFilter === 'paid' && ['paid', 'verified'].includes(order.paymentStatus || ''))
        || (paymentFilter === 'pending'
          && (['pending', 'pending_review'].includes(order.paymentStatus || '')
            || order.paymentMethod === 'Payo' && order.paymentStatus === 'unpaid'))
        || (paymentFilter !== 'cash_on_delivery' && paymentFilter !== 'paid' && order.paymentStatus === paymentFilter);
      return matchesConfirmation && matchesPayment;
    }),
    [confirmationFilter, orders, paymentFilter],
  );
  const filteredPayoPayments = payoStatusFilter === 'all'
    ? payoPayments
    : payoPayments.filter(payment => payment.status === payoStatusFilter);
  const issueCount = orders.filter(order => order.customerConfirmationStatus === 'issue_reported').length;

  const viewReceipt = async (id: string) => {
    try {
      const blob = await getPaymentReceiptImage(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open receipt.');
    }
  };

  const reviewPayment = async (id: string, action: 'approve' | 'reject', note: string) => {
    try {
      await apiRequest(`/payments/admin/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action, note }),
      });
      setRejectionReasons(current => ({ ...current, [id]: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to review payment.');
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await apiRequest(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update order.');
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-red-700">Store management</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Customer orders</h1>
          <p className="mt-1 text-sm text-neutral-500">Review incoming orders and update their fulfillment status.</p>
        </div>
        <button type="button" onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-bold">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="mb-7 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Legacy Payo payment records</h2>
            <p className="mt-1 text-sm text-neutral-500">Read-only historical records. New checkout and payment retries are disabled.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Status
            <select value={payoStatusFilter} onChange={e => setPayoStatusFilter(e.target.value as typeof payoStatusFilter)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2">
              <option value="all">All legacy records</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>
        {filteredPayoPayments.length === 0 ? <p className="text-sm text-neutral-500">No legacy payment records match this filter.</p> : (
          <div className="space-y-3">
            {filteredPayoPayments.map(payment => (
              <article key={payment.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{payment.orderNumber} · {payment.customerName}</p>
                    <p className="text-[10px] text-neutral-400">Order ID: {payment.orderId}</p>
                    <p className="text-xs text-neutral-500">Payo order: {payment.payoOrderId || 'Awaiting provider response'}</p>
                    <p className="text-xs text-neutral-500">Payment reference: {payment.paymentReference}</p>
                    <p className="mt-1 text-xs text-neutral-500">Created {new Date(payment.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{payment.currency} {Number(payment.amount).toLocaleString()}</p>
                    <span className={`text-xs font-bold ${payment.status === 'paid' ? 'text-green-700' : payment.status === 'rejected' || payment.status === 'failed' ? 'text-red-700' : 'text-amber-700'}`}>
                      {payment.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                {(payment.transactionReference || payment.senderName || payment.paidAt) && (
                  <div className="mt-2 grid gap-1 border-t border-neutral-100 pt-2 text-xs text-neutral-600 sm:grid-cols-2">
                    {payment.transactionReference && <p>Bank transaction: <strong>{payment.transactionReference}</strong></p>}
                    {payment.senderName && <p>Sender: <strong>{payment.senderName}</strong></p>}
                    {payment.paidAt && <p>Paid at: <strong>{new Date(payment.paidAt).toLocaleString()}</strong></p>}
                  </div>
                )}
                {payment.initializationError && (
                  <p className="mt-2 text-xs font-semibold text-red-700">
                    Recorded checkout issue: {payment.initializationError.replace(/_/g, ' ')}.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-7 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-black">Bank transfer verification</h2>
          <p className="mt-1 text-sm text-neutral-500">Review receipts that could not be automatically confirmed. Approve only after checking your actual bank account.</p>
        </div>
        {payments.length === 0 ? <p className="text-sm text-neutral-500">No payment submissions yet.</p> : (
          <div className="space-y-3">
            {payments.map(payment => (
              <article key={payment.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{payment.orderNumber} · {payment.customerName}</p>
                    <p className="text-xs text-neutral-500">{payment.bank.toUpperCase()} · Ref: {payment.reference}</p>
                    <p className="text-xs text-neutral-500">Sender: {payment.senderName || 'Not provided'} · {new Date(payment.createdAt).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-neutral-600">
                      {payment.items.map(item => `${item.quantity} × ${item.name}`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">ETB {Number(payment.amount).toLocaleString()}</p>
                    <span className={`text-xs font-bold ${payment.status === 'verified' ? 'text-green-700' : payment.status === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                      {payment.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {payment.hasReceipt && <button type="button" onClick={() => void viewReceipt(payment.id)} className="mt-2 text-xs font-bold text-blue-700 underline">View uploaded receipt</button>}
                {payment.status === 'pending_review' && (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs font-semibold text-neutral-700">
                      Rejection reason
                      <textarea
                        value={rejectionReasons[payment.id] || ''}
                        onChange={event => setRejectionReasons(current => ({ ...current, [payment.id]: event.target.value }))}
                        rows={2}
                        maxLength={500}
                        className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void reviewPayment(payment.id, 'approve', 'Verified by store administrator.')} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white">Approve after bank check</button>
                      <button type="button" onClick={() => void reviewPayment(payment.id, 'reject', (rejectionReasons[payment.id] || '').trim())}
                        disabled={(rejectionReasons[payment.id] || '').trim().length < 5}
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-7 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-black">Payment verification history</h2>
          <p className="mt-1 text-sm text-neutral-500">Administrator decisions, reasons, and timestamps.</p>
        </div>
        {reviewHistory.length === 0 ? <p className="text-sm text-neutral-500">No payment reviews have been recorded.</p> : (
          <div className="space-y-3">
            {reviewHistory.map(entry => (
              <article key={entry.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-bold">{entry.orderNumber} · Ref: {entry.reference}</p>
                  <p className={entry.action === 'approved' ? 'font-bold text-green-700' : 'font-bold text-red-700'}>
                    {entry.action} · ETB {Number(entry.amount).toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {entry.reviewerName || 'Former administrator'} · {new Date(entry.reviewedAt).toLocaleString()}
                </p>
                {entry.note && <p className="mt-2 whitespace-pre-wrap text-neutral-700">{entry.note}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Delivery confirmations</h2>
          <p className="text-sm text-neutral-500">Delivery completion and customer receipt responses are tracked separately.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          Payment
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as OrderPaymentFilter)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
            <option value="all">All payment methods/statuses</option>
            <option value="cash_on_delivery">Cash on delivery</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          Confirmation
          <select value={confirmationFilter} onChange={e => setConfirmationFilter(e.target.value as ConfirmationFilter)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
            <option value="all">All confirmations</option>
            <option value="awaiting_confirmation">Awaiting customer confirmation</option>
            <option value="customer_confirmed">Customer confirmed</option>
            <option value="issue_reported">Issue reported</option>
          </select>
        </label>
      </div>

      {issueCount > 0 && (
        <div role="status" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {issueCount} customer delivery {issueCount === 1 ? 'issue needs' : 'issues need'} review.
        </div>
      )}

      {loading ? <p className="rounded-xl bg-white p-8 text-center text-sm text-neutral-500">Loading orders…</p>
        : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
            <ShoppingBag className="mx-auto text-neutral-400" size={32} />
            <p className="mt-3 font-bold">{orders.length === 0 ? 'No orders yet' : 'No orders match the selected filters'}</p>
            <p className="mt-1 text-sm text-neutral-500">{orders.length === 0 ? 'Customer orders will appear here.' : 'Choose another payment or confirmation status.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const confirmationStatus = order.customerConfirmationStatus;
              const reportedIssue = confirmationStatus === 'issue_reported';
              return (
                <article key={order.id} className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap justify-between gap-3 border-b border-neutral-100 pb-3">
                    <div>
                      <h3 className="font-extrabold">{order.orderNumber}</h3>
                      <p className="text-[10px] text-neutral-400">ID: {order.id}</p>
                      <p className="mt-1 text-xs text-neutral-500">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">ETB {Number(order.total).toLocaleString()}</p>
                      <p className="text-xs text-neutral-500">{order.paymentMethod}</p>
                      <p className={`text-xs font-bold ${order.paymentStatus === 'paid' || order.paymentStatus === 'verified' ? 'text-green-700' : order.paymentStatus === 'rejected' || order.paymentStatus === 'failed' ? 'text-red-700' : 'text-amber-700'}`}>
                        Payment: {(order.paymentStatus || 'unpaid').replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 py-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase text-neutral-500">Customer</p>
                      <p className="mt-1 text-sm font-semibold">{order.customerName}</p>
                      <p className="text-sm text-neutral-600">{order.email} · {order.phone}</p>
                      <p className="mt-1 text-sm text-neutral-600">{order.deliveryAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-neutral-500">Items</p>
                      {order.items.map(item => (
                        <p key={item.productId} className="mt-1 text-sm">
                          {item.quantity} × {item.name} <span className="text-neutral-500">(ETB {Number(item.unitPrice).toLocaleString()})</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-lg border p-3 ${reportedIssue ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-neutral-50'}`}>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p><span className="font-bold">Delivery person:</span> {order.deliveryPersonName || 'Not assigned'}</p>
                      <p><span className="font-bold">Delivery status:</span> {order.deliveryStatus?.replace(/_/g, ' ') || 'Not assigned'}</p>
                      <p><span className="font-bold">Delivered at:</span> {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}</p>
                      <p>
                        <span className="font-bold">Customer confirmation:</span>{' '}
                        {confirmationStatus ? confirmationLabels[confirmationStatus] : 'Not requested'}
                      </p>
                      {order.customerConfirmedAt && (
                        <p><span className="font-bold">Customer response time:</span> {new Date(order.customerConfirmedAt).toLocaleString()}</p>
                      )}
                      {order.customerDeliveryIssueReportedAt && (
                        <p><span className="font-bold">Issue reported:</span> {new Date(order.customerDeliveryIssueReportedAt).toLocaleString()}</p>
                      )}
                    </div>
                    {reportedIssue && (
                      <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-800">
                        <p className="font-black">Customer reports this order was not received</p>
                        <p className="mt-1 whitespace-pre-wrap">{order.customerDeliveryIssue}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{order.status}</span>
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      Update status
                      <select value={order.status} onChange={e => void changeStatus(order.id, e.target.value)}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm capitalize">
                        {[order.status, ...statuses.filter(status => status !== order.status)].map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        )}
    </section>
  );
}
