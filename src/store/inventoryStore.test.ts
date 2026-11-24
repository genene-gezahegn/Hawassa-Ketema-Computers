import { beforeEach, describe, expect, it } from 'vitest';
import { defaultInventory } from '../lib/inventory';
import { getRolePermissions, useInventoryStore } from './inventoryStore';

describe('inventory role permissions', () => {
  beforeEach(() => {
    useInventoryStore.setState({
      products: [...defaultInventory],
      currentUserRole: 'Admin',
      currentUser: 'Test Admin',
    });
  });

  it('grants each role only its intended capabilities', () => {
    expect(getRolePermissions('Admin')).toEqual({
      canAddProduct: true,
      canEditProduct: true,
      canManageStock: true,
      canManageSettings: true,
    });
    expect(getRolePermissions('Staff')).toEqual({
      canAddProduct: true,
      canEditProduct: false,
      canManageStock: true,
      canManageSettings: false,
    });
    expect(getRolePermissions('Viewer')).toEqual({
      canAddProduct: false,
      canEditProduct: false,
      canManageStock: false,
      canManageSettings: false,
    });
    expect(getRolePermissions('Customer')).toEqual({
      canAddProduct: false,
      canEditProduct: false,
      canManageStock: false,
      canManageSettings: false,
    });
  });

  it('blocks customer product creation without changing inventory', () => {
    useInventoryStore.getState().setUserRole('Customer');
    const productsBefore = useInventoryStore.getState().products;

    const result = useInventoryStore.getState().addProduct({
      name: 'Unauthorized product',
      brand: 'Demo',
      model: 'D-1',
      category: 'Laptop',
      condition: 'Brand New',
    });

    expect(result).toMatchObject({ success: false });
    expect(useInventoryStore.getState().products).toBe(productsBefore);
  });

  it('allows Staff to add products but not edit existing product details', () => {
    useInventoryStore.getState().setUserRole('Staff');
    const addResult = useInventoryStore.getState().addProduct({
      name: 'Staff-added product',
      brand: 'Demo',
      model: 'D-2',
      category: 'Laptop',
      condition: 'Brand New',
    });
    const updateResult = useInventoryStore.getState().updateProduct('prod-001', { name: 'Changed name' });

    expect('id' in addResult).toBe(true);
    expect(updateResult).toMatchObject({ success: false });
    expect(useInventoryStore.getState().products[0].name).toBe('Staff-added product');
  });
});