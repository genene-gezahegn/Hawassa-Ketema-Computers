import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, clearSession, deactivateApiProduct, getToken, publishUnpublishedInventory, respondToDeliveryConfirmation, saveSession, updateApiProductPhoto } from './api';
import { defaultInventory } from './inventory';

describe('publishUnpublishedInventory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it('exposes HTTP error status without changing the saved session', async () => {
    saveSession('employee-token', {
      id: 'employee-id',
      fullName: 'Store Employee',
      email: 'employee@example.com',
      role: 'employee',
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Please log in to continue.' }),
    } as Response)));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      message: 'Please log in to continue.',
      status: 401,
    });
    expect(getToken()).toBe('employee-token');
  });

  describe('respondToDeliveryConfirmation', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      clearSession();
    });

    it('submits the customer response to the authenticated order endpoint', async () => {
      saveSession('customer-token', {
        id: 'customer-id',
        fullName: 'Store Customer',
        email: 'customer@example.com',
        role: 'customer',
      });
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, _options?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Your delivery concern has been submitted.' }),
      } as Response));
      vi.stubGlobal('fetch', fetchMock);
      const orderId = 'c0d043f1-8c06-4b24-a032-6f7aefb3ff4a';

      await respondToDeliveryConfirmation(orderId, {
        response: 'not_received',
        details: 'The package was not handed to me.',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(String(url)).toContain(`/orders/mine/${orderId}/delivery-confirmation`);
      expect(options?.method).toBe('POST');
      expect(options?.headers).toMatchObject({ Authorization: 'Bearer customer-token' });
      expect(JSON.parse(String(options?.body))).toEqual({
        response: 'not_received',
        details: 'The package was not handed to me.',
      });
    });
  });

  it('publishes locally entered items without uploading bundled demo inventory', async () => {
    saveSession('admin-token', {
      id: 'admin-id',
      fullName: 'Store Admin',
      email: 'admin@example.com',
      role: 'admin',
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/products') && !options?.method) {
        return { ok: true, status: 200, json: async () => ({ products: [] }) } as Response;
      }
      if (url.endsWith('/products') && options?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ product: { id: 'server-product-id' } }) } as Response;
      }
      throw new Error(`Unexpected request: ${options?.method || 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const locallyEnteredProduct = { ...defaultInventory[0], id: 'prod-1730000000000', sku: 'REAL-ITEM-1' };

    const publishedIds = await publishUnpublishedInventory([...defaultInventory, locallyEnteredProduct]);

    expect(publishedIds).toEqual({ [locallyEnteredProduct.id]: 'server-product-id' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(postBody.sku).toBe('REAL-ITEM-1');
  });

  it('updates and deactivates an API product using admin-authenticated requests', async () => {
    saveSession('admin-token', {
      id: 'admin-id',
      fullName: 'Store Admin',
      email: 'admin@example.com',
      role: 'admin',
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => ({
      ok: true,
      status: options?.method === 'DELETE' ? 204 : 200,
      json: async () => ({ product: { id: 'product-id' } }),
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    await updateApiProductPhoto('product-id', 'data:image/png;base64,AAAA');
    await deactivateApiProduct('product-id');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer admin-token' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      productPhoto: 'data:image/png;base64,AAAA',
    });
    expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE');
  });
});
