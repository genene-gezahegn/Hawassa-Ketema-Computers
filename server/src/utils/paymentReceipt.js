import { HttpError } from './errors.js';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export function decodePaymentReceipt(receiptMime, receiptData) {
  if (Boolean(receiptData) !== Boolean(receiptMime)) {
    throw new HttpError(400, 'Receipt file data and type must be provided together.');
  }

  if (!receiptData) return null;

  const receiptBuffer = Buffer.from(receiptData, 'base64');
  if (
    receiptBuffer.length > MAX_RECEIPT_BYTES
    || receiptBuffer.toString('base64').replace(/=+$/, '') !== receiptData.replace(/=+$/, '')
  ) {
    throw new HttpError(400, 'Receipt file must be valid and 5 MB or smaller.');
  }

  const mimeMatches = receiptMime === 'image/jpeg'
    ? receiptBuffer[0] === 0xff && receiptBuffer[1] === 0xd8 && receiptBuffer[2] === 0xff
    : receiptMime === 'image/png'
      ? receiptBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : receiptMime === 'image/webp'
        ? receiptBuffer.toString('ascii', 0, 4) === 'RIFF' && receiptBuffer.toString('ascii', 8, 12) === 'WEBP'
        : receiptBuffer.toString('ascii', 0, 5) === '%PDF-';

  if (!mimeMatches) throw new HttpError(400, 'The uploaded file does not match its declared type.');
  return receiptBuffer;
}
