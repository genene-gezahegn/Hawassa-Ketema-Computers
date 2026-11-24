import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession, saveSession } from '../lib/api';
import EmployeeDashboard from './EmployeeDashboard';

const employee = {
  id: 'employee-id',
  fullName: 'Old Employee',
  email: 'employee@example.com',
  phone: '0912345678',
  role: 'employee' as const,
};

describe('employee profile', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    clearSession();
  });

  it('loads and saves profile details using the authenticated profile endpoint', async () => {
    saveSession('employee-token', employee);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/employee/orders')) return { orders: [] };
      if (url.endsWith('/employee/dashboard')) return { stats: { toProcess: 0, inProgress: 0, readyForDelivery: 0 } };
      if (url.endsWith('/employee/permissions')) return { permissions: [] };
      if (url.endsWith('/auth/me') && options?.method === 'PATCH') {
        return { user: { ...employee, fullName: 'Updated Employee', phone: '0998765432' } };
      }
      if (url.endsWith('/auth/me')) return { user: employee };
      throw new Error(`Unexpected request: ${options?.method || 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const data = await fetchMock(input, options);
      return { ok: true, status: 200, json: async () => data } as Response;
    }));

    const user = userEvent.setup();
    render(<EmployeeDashboard />);
    await user.click(screen.getAllByRole('button', { name: 'Profile' })[0]);
    const nameInput = await screen.findByLabelText('Full name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Employee');
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '0998765432');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile updated.')).toBeTruthy();
    const updateCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(updateCall?.[1]?.headers).toMatchObject({ Authorization: 'Bearer employee-token' });
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      fullName: 'Updated Employee',
      phone: '0998765432',
    });
  });
});
