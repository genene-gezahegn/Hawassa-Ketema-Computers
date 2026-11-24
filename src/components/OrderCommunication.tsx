import { FormEvent, useEffect, useState } from 'react';
import { LoaderCircle, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { listOrderMessages, OrderMessage, sendOrderMessage } from '../lib/api';

export default function OrderCommunication({ orderId }: { orderId: string }) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setMessages(await listOrderMessages(orderId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load order messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [orderId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      await sendOrderMessage(orderId, message);
      setDraft('');
      setNotice('Message sent.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3" aria-label="Order messages">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold inline-flex items-center gap-2">
          <MessageCircle size={16} className="text-red-600" /> Order messages
        </h3>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex items-center gap-1 text-xs font-bold text-neutral-500 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <p className="text-xs text-neutral-500">Messages are visible to the customer, assigned delivery person, and store staff.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{notice}</p>}
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-3">
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-neutral-500"><LoaderCircle size={14} className="animate-spin" /> Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-neutral-500">No messages yet. Send a message if you need help with this order.</p>
        ) : messages.map(message => (
          <article key={message.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap justify-between gap-1 text-[11px] text-neutral-500">
              <span className="font-bold text-neutral-700">{message.senderName}</span>
              <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-800">{message.message}</p>
          </article>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-2">
        <label className="sr-only" htmlFor={`order-message-${orderId}`}>Write a message</label>
        <textarea id={`order-message-${orderId}`} value={draft} onChange={e => setDraft(e.target.value)}
          maxLength={2000} rows={3} placeholder="Write a message about this order…"
          className="w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-500" />
        <button type="submit" disabled={sending || !draft.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {sending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </section>
  );
}
