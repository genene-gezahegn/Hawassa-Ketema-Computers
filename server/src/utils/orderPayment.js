import { HttpError } from './errors.js';

export async function assertOrderPaymentVerified(client, order, messagePrefix) {
  const paymentMethod = order.payment_method ?? order.paymentMethod;
  const orderId = order.id ?? order.orderId;
  if (paymentMethod === 'Bank transfer' || paymentMethod === 'Manual bank transfer') {
    const { rows } = await client.query(
      `SELECT status FROM order_payments
       WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [orderId],
    );
    if (rows[0]?.status !== 'verified') {
      throw new HttpError(409, `${messagePrefix} Verify the bank transfer first.`);
    }
  } else if (paymentMethod === 'Payo') {
    const { rows } = await client.query(
      `SELECT status FROM payo_payments
       WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [orderId],
    );
    if (rows[0]?.status !== 'paid') {
      throw new HttpError(409, `${messagePrefix} This legacy payment has not been confirmed.`);
    }
  }
}
