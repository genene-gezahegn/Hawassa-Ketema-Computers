import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useInventoryStore } from './store/inventoryStore';
import App from './App';

describe('admin header search', () => {
  beforeEach(() => {
    useInventoryStore.setState({
      currentUserRole: 'Admin',
      activeView: 'dashboard',
      selectedCategory: null,
      selectedStatus: 'all',
      selectedBrand: 'all',
      selectedCondition: 'all',
      searchQuery: '',
      isSearchOpen: false,
      isMenuOpen: false,
    });
  });

  it('closes the search field without clearing the entered query', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle search' }));
    const searchField = screen.getByPlaceholderText('Search products by model, brand, SKU or specs...');
    fireEvent.change(searchField, { target: { value: 'Dell' } });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle search' }));

    expect(screen.queryByPlaceholderText('Search products by model, brand, SKU or specs...')).toBeNull();
    expect(useInventoryStore.getState().searchQuery).toBe('Dell');
  });
});