import assert from 'node:assert/strict';
import { test } from 'node:test';
import authRoutes from '../src/routes/auth.js';

test('keeps login and registration routes without password-reset routes', () => {
  const routePaths = authRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  assert.ok(routePaths.includes('/login'));
  assert.ok(routePaths.includes('/register'));
  assert.equal(routePaths.includes('/forgot-password'), false);
  assert.equal(routePaths.includes('/reset-password'), false);
});
