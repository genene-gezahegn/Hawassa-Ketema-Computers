import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultInventory } from '../lib/inventory';
import { useInventoryStore } from '../store/inventoryStore';
import { clearSession, saveSession } from '../lib/api';
import CustomerStorefront from './CustomerStorefront';
import { CustomerCheckout } from './CustomerOrderViews';
import App from '../App';

describe('customer storefront', () => {
  beforeEach(() => {
    useInventoryStore.setState({
      products: [...defaultInventory],
      currentUserRole: 'Customer',
      currentUser: 'Demo Customer',
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    clearSession();
    window.history.replaceState({}, '', '/');
  });

  it('shows bank-transfer details and collects the transaction reference and receipt', async () => {
    const product = defaultInventory[0];
    if (!product) throw new Error('Expected a product fixture.');
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onCheckoutChange = vi.fn();
    const testNavigator = Object.create(navigator);
    testNavigator.clipboard = { writeText };
    vi.stubGlobal('navigator', testNavigator);
    render(
      <CustomerCheckout
        cartLines={[{ product, quantity: 1 }]}
        cartTotal={product.price}
        checkout={{
          name: '',
          email: '',
          phone: '',
          address: '',
          paymentMethod: 'Bank transfer',
          bank: 'cbe',
          bankTransactionReference: '',
          senderName: '',
          receiptFile: null,
        }}
        onCheckoutChange={onCheckoutChange}
        onUpdateCart={() => {}}
        onPlaceOrder={event => event.preventDefault()}
        placingOrder={false}
        onBrowseCatalog={() => {}}
        paymentInstructions={{
          bankName: 'Commercial Bank',
          accountName: 'Hawassa-Ketema Computers',
          accountNumber: '0123456789',
          instructions: '',
        }}
      />,
    );

    expect(screen.getByText('Commercial Bank')).toBeTruthy();
    expect(screen.getByText('Hawassa-Ketema Computers')).toBeTruthy();
    expect(screen.getByText('0123456789')).toBeTruthy();
    expect(screen.getByText('0930407122')).toBeTruthy();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Telebirr') === true)).toBeTruthy();
    expect(screen.getByText(`Exact amount due: ETB ${product.price.toLocaleString()}`)).toBeTruthy();
    expect(screen.getByLabelText('Bank or wallet')).toBeTruthy();
    expect(screen.getByLabelText('Bank transaction reference')).toBeTruthy();
    expect(screen.getByLabelText('Sender name')).toBeTruthy();
    expect(screen.getByLabelText(/Receipt image/)).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Payo/i })).toBeNull();
    fireEvent.change(screen.getByLabelText('Bank transaction reference'), { target: { value: 'TXN-12345' } });
    expect(onCheckoutChange).toHaveBeenCalledWith({ bankTransactionReference: 'TXN-12345' });
    screen.getByRole('button', { name: 'Copy account number' }).click();
    expect(await screen.findByText('Copied')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith('0123456789');
    screen.getByRole('button', { name: 'Copy additional account number' }).click();
    await waitFor(() => expect(screen.getAllByText('Copied')).toHaveLength(2));
    expect(writeText).toHaveBeenCalledWith('0930407122');
    expect(screen.queryByRole('button', { name: 'Copy Telebirr bank' })).toBeNull();
  });

  it('opens customer sign-in, hides password recovery, and supports account creation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const response = url.includes('/auth/google/config')
        ? { clientId: null }
        : url.includes('/products')
          ? { products: [] }
          : {};
      return { ok: true, status: 200, json: async () => response } as Response;
    }));
    const user = userEvent.setup();
    render(<CustomerStorefront />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText('Staff sign in')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Forgot password?' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('heading', { name: 'Create account' })).toBeTruthy();
    expect(screen.getByLabelText('Full name')).toBeTruthy();
  });

  it('routes an administrator to the admin dashboard through sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      let response = {};
      if (url.includes('/auth/google/config')) response = { clientId: null };
      if (url.endsWith('/auth/login')) {
        response = {
          token: 'admin-token',
          user: { id: 'admin-id', fullName: 'Store Admin', email: 'admin@example.com', role: 'admin' },
        };
      }
      if (url.includes('/products')) response = { products: [] };
      return { ok: true, status: 200, json: async () => response } as Response;
    }));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.type(await screen.findByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'admin-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByTitle('Sign out of administrator account')).toBeTruthy();
    expect(useInventoryStore.getState().currentUserRole).toBe('Admin');
    expect(useInventoryStore.getState().currentUser).toContain('Store Admin');
  });

  it('registers new accounts as customers and opens the customer storefront', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const response = url.includes('/auth/google/config')
        ? { clientId: null }
        : url.endsWith('/auth/register')
          ? {
            token: 'customer-token',
            user: { id: 'customer-id', fullName: 'New Customer', email: 'new@example.com', role: 'customer' },
          }
          : url.endsWith('/orders/mine')
            ? { orders: [] }
            : url.includes('/products')
              ? { products: [] }
              : {};
      return { ok: true, status: 200, json: async () => response } as Response;
    }));
    const user = userEvent.setup();
    render(<CustomerStorefront />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Full name'), 'New Customer');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'customer-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back, New' })).toBeTruthy();
    expect(useInventoryStore.getState().currentUserRole).toBe('Customer');
  });

  it('does not show bundled demo products to an authenticated customer when the API catalog is empty', async () => {
    saveSession('customer-token', {
      id: 'customer-id',
      fullName: 'Real Customer',
      email: 'customer@example.com',
      role: 'customer',
    });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const response = url.endsWith('/auth/me')
        ? { user: { id: 'customer-id', fullName: 'Real Customer', email: 'customer@example.com', role: 'customer' } }
        : url.endsWith('/products')
          ? { products: [] }
          : url.endsWith('/orders/mine')
            ? { orders: [] }
            : {};
      return { ok: true, status: 200, json: async () => response } as Response;
    }));

    render(<CustomerStorefront />);

    expect(await screen.findByText('The shop has no published products yet. Ask an administrator to publish real inventory.')).toBeTruthy();
    expect(screen.queryByText('USB-C 8-in-1 Multiport Adapter Hub')).toBeNull();
  });

  it('lets a guest browse products but requires sign-in to place an order', async () => {
    const user = userEvent.setup();
    render(<CustomerStorefront />);

    await user.click(screen.getByRole('button', { name: 'Enter storefront demo' }));
    expect(screen.getByRole('heading', { name: 'Welcome back, Demo' })).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: /Browse catalog/i })[0]);
    expect(screen.getByRole('heading', { name: 'Find your next upgrade' })).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'Add to cart' })[0]);
    await user.click(screen.getByRole('button', { name: 'Cart, 1 items' }));
    expect(screen.getByRole('heading', { name: 'Delivery details' })).toBeTruthy();

    await user.type(screen.getByLabelText('Phone'), '0912345678');
    await user.type(screen.getByLabelText('Delivery address'), 'Hawassa');
    await user.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText(/Demo order HK-/)).toBeNull();
  });
});