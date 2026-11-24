/**
 * Hawassa-Ketema Computers - Zustand Inventory Store
 * Master Spec - Section 2, 3, 4, 5, 7, 8, 10, 12, 13, 14, 24
 * Defense-in-Depth Role Authorization Guarding
 */

import { create } from 'zustand';
import { apiRequest, getToken, toApiProductPayload } from '../lib/api';
import {
  Product,
  Category,
  StockStatus,
  ProductCondition,
  DashboardCounts,
  SerialNumberItem,
  defaultInventory,
  getDashboardCounts,
  calculateStockStatus,
  getStockStatus,
  generateProductCode,
  getInventoryValue,
} from '../lib/inventory';

export type ActiveView =
  | 'dashboard'
  | 'inventory'
  | 'product_details'
  | 'add_item'
  | 'stock_out'
  | 'out_of_stock'
  | 'low_stock'
  | 'reports'
  | 'stock_history'
  | 'settings'
  | 'scan'
  | 'orders'
  | 'staff'
  | 'delivery_mgmt';

export type SortOption =
  | 'quantity_desc'
  | 'quantity_asc'
  | 'name_asc'
  | 'name_desc'
  | 'date_desc'
  | 'date_asc';

export type TransactionAction = 'Stock In' | 'Stock Out';

export type StockOutReason = 'Sold' | 'Damaged' | 'Returned' | 'Transferred' | 'Other';

export type UserRole = 'Admin' | 'Staff' | 'Viewer' | 'Customer' | 'Employee' | 'Delivery';

export interface RolePermissions {
  canAddProduct: boolean;
  canEditProduct: boolean;
  canManageStock: boolean;
  canManageSettings: boolean;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  return {
    canAddProduct: role === 'Admin' || role === 'Staff',
    canEditProduct: role === 'Admin',
    canManageStock: role === 'Admin' || role === 'Staff',
    canManageSettings: role === 'Admin',
  };
}

export interface ActionErrorResult extends Error {
  error: string;
  success: boolean;
}

/**
 * Creates a standardized defense-in-depth error object for Viewer role actions.
 * Implements both Error instance and { error, success: false } structure.
 */
export function createViewerRoleError(actionName: string): ActionErrorResult {
  const message = `Permission denied: User with 'Viewer' role cannot perform '${actionName}'.`;
  const err = new Error(message) as ActionErrorResult;
  err.name = 'AuthorizationError';
  err.error = message;
  err.success = false;
  return err;
}

export function createCustomerRoleError(actionName: string): ActionErrorResult {
  const message = `Permission denied: Customer role cannot perform '${actionName}'.`;
  const err = new Error(message) as ActionErrorResult;
  err.name = 'AuthorizationError';
  err.error = message;
  err.success = false;
  return err;
}

export function createStaffRoleError(actionName: string): ActionErrorResult {
  const message = `Permission denied: Staff role cannot perform '${actionName}'.`;
  const err = new Error(message) as ActionErrorResult;
  err.name = 'AuthorizationError';
  err.error = message;
  err.success = false;
  return err;
}

function getInventoryMutationError(role: UserRole, actionName: string): ActionErrorResult | null {
  const permissions = getRolePermissions(role);
  const isAllowed = actionName === 'addProduct'
    ? permissions.canAddProduct
    : actionName === 'updateProduct'
      ? permissions.canEditProduct
      : permissions.canManageStock;

  if (isAllowed) return null;
  if (role === 'Customer') return createCustomerRoleError(actionName);
  if (role === 'Staff') return createStaffRoleError(actionName);
  return createViewerRoleError(actionName);
}

export interface InventoryTransaction {
  id: string;
  timestamp: string; // Date and Time
  productId: string;
  productName: string;
  sku: string;
  quantityChange: number; // e.g. +5, -2
  action: TransactionAction; // 'Stock In' | 'Stock Out'
  reason: string; // 'Sold', 'Damaged', 'Returned', 'Transferred', 'Other', etc.
  user: string; // Name of user e.g. 'Genene (Admin)'
  notes?: string;
  serialNumbers?: string[]; // Serial numbers involved
  resultingQuantity: number;
}

export interface InventoryStoreState {
  products: Product[];
  setProducts: (products: Product[]) => void;
  transactions: InventoryTransaction[]; // Section 13 & 24 transactions array
  activeView: ActiveView;
  selectedProductId: string | null;
  selectedCategory: Category | null;
  selectedStatus: StockStatus | 'all';
  selectedBrand: string | 'all';
  selectedCondition: ProductCondition | 'all';
  sortOption: SortOption;
  searchQuery: string;
  isSearchOpen: boolean;
  isMenuOpen: boolean;
  unreadNotifications: number;
  lastAddedProduct: Product | null;
  currentUser: string;
  currentUserRole: UserRole; // Role-based defense-in-depth

  // Role Management
  setUserRole: (role: UserRole) => void;

  // Actions
  setActiveView: (view: ActiveView) => void;
  viewProductDetails: (productId: string) => void;

  // Master Spec Required Guarded Actions (Defense in Depth)
  // If role is 'Viewer', immediately returns error and does NOT mutate state
  addProduct: (item: Partial<Product>) => Product | ActionErrorResult;
  updateProduct: (productId: string, updates: Partial<Product>) => { success: true; product: Product } | ActionErrorResult;
  stockIn: (params: {
    productId: string;
    quantity: number;
    newSerialNumbers?: string[];
    reason?: string;
    user?: string;
    notes?: string;
    date?: string;
  }) => boolean | ActionErrorResult;
  stockOut: (params: {
    productId: string;
    quantity: number;
    selectedSerialNumbers?: string[];
    reason: StockOutReason;
    user?: string;
    notes?: string;
    date?: string;
  }) => boolean | ActionErrorResult;

  // Aliases for Section 8 & Section 10
  restockProduct: (params: {
    productId: string;
    quantity: number;
    newSerialNumbers?: string[];
    reason?: string;
    user?: string;
    notes?: string;
    date?: string;
  }) => boolean;
  stockOutProduct: (params: {
    productId: string;
    quantity: number;
    selectedSerialNumbers?: string[];
    reason: StockOutReason;
    user?: string;
    notes?: string;
    date?: string;
  }) => boolean;

  updateStock: (productId: string, delta: number, reason?: string) => void;
  recordStockOut: (productId: string, quantity: number, notes?: string) => boolean;
  setSelectedCategory: (category: Category | null) => void;
  setSelectedStatus: (status: StockStatus | 'all') => void;
  setSelectedBrand: (brand: string | 'all') => void;
  setSelectedCondition: (condition: ProductCondition | 'all') => void;
  setSortOption: (sort: SortOption) => void;
  setSearchQuery: (query: string) => void;
  toggleSearch: () => void;
  setMenuOpen: (open: boolean) => void;
  clearNotificationBadge: () => void;
  resetFilters: () => void;
  clearLastAddedProduct: () => void;
  setCurrentUser: (name: string) => void;
}


function persistProduct(product: Product, method: 'POST' | 'PATCH') {
  if (!getToken()) return;
  const body = toApiProductPayload(product);
  const path = method === 'POST' ? '/products' : `/products/${product.id}`;
  apiRequest<{product:{id:string}}>(path,{method,body:JSON.stringify(body)}).then((result)=>{
    if(method==='POST' && result?.product?.id) useInventoryStore.setState((state)=>({products:state.products.map((item)=>item.id===product.id?{...item,id:result.product.id}:item)}));
  }).catch((error)=>console.error('Unable to persist product to API:',error));
}

export const useInventoryStore = create<InventoryStoreState>((set, get) => ({
  products: [...defaultInventory],
  setProducts: (products) => set({ products }),
  activeView: 'dashboard',
  selectedProductId: null,
  selectedCategory: null,
  selectedStatus: 'all',
  selectedBrand: 'all',
  selectedCondition: 'all',
  sortOption: 'date_desc',
  searchQuery: '',
  isSearchOpen: false,
  isMenuOpen: false,
  unreadNotifications: 3,
  lastAddedProduct: null,
  currentUser: 'Demo Customer',
  currentUserRole: 'Customer' as UserRole,

  // Initial persistent transactions log (NEVER erased)
  transactions: [
    {
      id: 'tx-101',
      timestamp: '2026-11-01 14:30:00',
      productId: 'prod-001',
      productName: 'HP ProBook 450 G10',
      sku: 'HK-LAP-HP-1011',
      quantityChange: 10,
      action: 'Stock In',
      reason: 'Purchase / Restock',
      user: 'Genene (Admin)',
      notes: 'Initial container restock from Addis IT Imports PLC.',
      serialNumbers: ['5CD34199KL-01', '5CD34199KL-02', '5CD34199KL-03'],
      resultingQuantity: 14,
    },
    {
      id: 'tx-102',
      timestamp: '2026-10-30 11:15:00',
      productId: 'prod-004',
      productName: 'Apple MacBook Air M2',
      sku: 'HK-LAP-APP-1014',
      quantityChange: -2,
      action: 'Stock Out',
      reason: 'Sold',
      user: 'Genene (Admin)',
      notes: 'Retail sale to client in Hawassa Media Hub. Changed to Out of Stock.',
      serialNumbers: ['C02TJ0AA0891-01', 'C02TJ0AA0891-02'],
      resultingQuantity: 0,
    },
    {
      id: 'tx-103',
      timestamp: '2026-11-02 09:20:00',
      productId: 'prod-012',
      productName: 'Logitech MX Master 3S Wireless Mouse',
      sku: 'HK-ACC-LOG-4011',
      quantityChange: 12,
      action: 'Stock In',
      reason: 'Purchase / Restock',
      user: 'Genene (Admin)',
      notes: 'Accessories delivery from Global IT Hardware Co.',
      resultingQuantity: 16,
    },
    {
      id: 'tx-104',
      timestamp: '2026-11-02 16:45:00',
      productId: 'prod-003',
      productName: 'Lenovo ThinkPad E14 Gen 5',
      sku: 'HK-LAP-LEN-1013',
      quantityChange: -1,
      action: 'Stock Out',
      reason: 'Sold',
      user: 'Genene (Admin)',
      notes: 'Customer store sale. Stock dropped to Low Stock warning level (2 units).',
      serialNumbers: ['PF3E9821-C'],
      resultingQuantity: 2,
    },
    {
      id: 'tx-105',
      timestamp: '2026-11-01 17:00:00',
      productId: 'prod-011',
      productName: 'Ritar Deep Cycle AGM Battery 12V 100Ah',
      sku: 'HK-PWR-RIT-3014',
      quantityChange: -1,
      action: 'Stock Out',
      reason: 'Sold',
      user: 'Genene (Admin)',
      notes: 'Sold for Telecom Tower installation. Quantity reached 0 (Out of Stock).',
      serialNumbers: ['RIT-100AH-3301-A'],
      resultingQuantity: 0,
    },
  ],

  setUserRole: (role: UserRole) => {
    set({ currentUserRole: role });
  },

  setActiveView: (view: ActiveView) => {
    set({
      activeView: view,
      isMenuOpen: false,
    });
  },

  viewProductDetails: (productId: string) => {
    set({
      selectedProductId: productId,
      activeView: 'product_details',
      isMenuOpen: false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  setCurrentUser: (name: string) => {
    set({ currentUser: name });
  },

  // GUARDED ACTION 1: addProduct (Defense in Depth)
  addProduct: (item: Partial<Product>): Product | ActionErrorResult => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'addProduct');
    if (roleError) {
      const err = roleError;
      console.error(err.message);
      return err;
    }

    const category: Category = item.category ?? 'Laptop';
    const brand = item.brand?.trim() || 'Generic';
    const quantity = Number(item.stockQuantity ?? item.quantity ?? 1);
    const lowStockThreshold = Number(item.lowStockThreshold ?? item.minimumStockLevel ?? 5);
    const sku = item.sku?.trim() || item.productCode?.trim() || generateProductCode(category, brand);
    const name = item.name?.trim() || item.productName?.trim() || `${brand} ${item.model ?? 'Item'}`;
    const status = calculateStockStatus(quantity, lowStockThreshold);
    const nowIso = new Date().toISOString().split('T')[0];

    // Build specs summary
    let specs = item.specs?.trim() || '';
    if (!specs) {
      if (category === 'Laptop' || category === 'Desktop') {
        const parts = [item.cpu, item.ram, item.ssd ? `${item.ssd} SSD` : '', item.gpu, item.screenSize].filter(Boolean);
        specs = parts.length > 0 ? parts.join(', ') : `${item.model ?? 'System'} standard configuration`;
      } else if (category === 'Power Solutions') {
        const parts = [item.capacity, item.voltage, item.powerRating].filter(Boolean);
        specs = parts.length > 0 ? parts.join(', ') : `${item.model ?? 'Power device'}`;
      } else {
        const parts = [item.connectivity, item.compatibility].filter(Boolean);
        specs = parts.length > 0 ? parts.join(', ') : `${item.model ?? 'Accessory'}`;
      }
    }

    // Auto-create serial numbers array if S/N was entered
    const serialNumbers: SerialNumberItem[] = item.serialNumbers && item.serialNumbers.length > 0
      ? item.serialNumbers
      : item.serialNumber
      ? [{ serialNumber: item.serialNumber.trim(), status: 'In Stock', location: item.storageLocation, dateLogged: nowIso }]
      : [];

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      sku,
      productCode: sku,
      name,
      productName: name,
      brand,
      category,
      subcategory: item.subcategory || 'Standard',
      model: item.model?.trim() || 'Standard Model',
      condition: item.condition || 'Brand New',
      specs,
      price: Number(item.price ?? item.sellingPrice ?? 0),
      sellingPrice: Number(item.price ?? item.sellingPrice ?? 0),
      buyingPrice: Number(item.buyingPrice ?? 0),
      stockQuantity: quantity,
      quantity,
      lowStockThreshold,
      minimumStockLevel: lowStockThreshold,
      supplier: item.supplier?.trim() || 'Hawassa Local Partner',
      storageLocation: item.storageLocation?.trim() || 'General Storage Area',
      productPhoto: item.productPhoto || '',
      notes: item.notes?.trim() || '',
      cpu: item.cpu?.trim(),
      ram: item.ram?.trim(),
      ssd: item.ssd?.trim(),
      hdd: item.hdd?.trim(),
      gpu: item.gpu?.trim(),
      screenSize: item.screenSize?.trim(),
      serialNumber: item.serialNumber?.trim(),
      serialNumbers,
      capacity: item.capacity?.trim(),
      voltage: item.voltage?.trim(),
      powerRating: item.powerRating?.trim(),
      connectivity: item.connectivity?.trim(),
      compatibility: item.compatibility?.trim(),
      status,
      dateAdded: nowIso,
      updatedAt: nowIso,
    };

    const newTransaction: InventoryTransaction = {
      id: `tx-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      productId: newProduct.id,
      productName: newProduct.name,
      sku: newProduct.sku,
      quantityChange: newProduct.stockQuantity,
      action: 'Stock In',
      reason: `Initial stock registration (${newProduct.condition})`,
      user: get().currentUser,
      notes: `Registered with ${newProduct.stockQuantity} initial units.`,
      serialNumbers: serialNumbers.map((s) => s.serialNumber),
      resultingQuantity: newProduct.stockQuantity,
    };

    set((state) => ({
      products: [newProduct, ...state.products],
      lastAddedProduct: newProduct,
      transactions: [newTransaction, ...state.transactions],
    }));
    persistProduct(newProduct, 'POST');
    return newProduct;
  },

  // GUARDED ACTION 2: updateProduct (Defense in Depth)
  updateProduct: (productId: string, updates: Partial<Product>) => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'updateProduct');
    if (roleError) {
      const err = roleError;
      console.error(err.message);
      return err;
    }

    const state = get();
    const product = state.products.find((p) => p.id === productId);
    if (!product) {
      const notFoundErr = new Error(`Product not found: ${productId}`) as ActionErrorResult;
      notFoundErr.error = `Product not found: ${productId}`;
      notFoundErr.success = false;
      return notFoundErr;
    }

    const updatedProduct: Product = {
      ...product,
      ...updates,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (updates.stockQuantity !== undefined || updates.lowStockThreshold !== undefined) {
      updatedProduct.status = getStockStatus(updatedProduct);
    }

    set({
      products: state.products.map((p) => (p.id === productId ? updatedProduct : p)),
    });
    persistProduct(updatedProduct, 'PATCH');
    return { success: true, product: updatedProduct };
  },

  // GUARDED ACTION 3: stockIn / restockProduct (Defense in Depth)
  stockIn: (params) => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'stockIn');
    if (roleError) {
      const err = roleError;
      console.error(err.message);
      return err;
    }
    return get().restockProduct(params);
  },

  restockProduct: ({ productId, quantity, newSerialNumbers = [], reason = 'Purchase / Restock', user, notes, date }) => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'restockProduct');
    if (roleError) {
      console.error(roleError.message);
      return false;
    }

    if (quantity <= 0) return false;

    const state = get();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return false;

    const newQuantity = product.stockQuantity + quantity;
    const newStatus = getStockStatus(newQuantity, product.lowStockThreshold);
    const dateFormatted = date || new Date().toLocaleString();

    // Append new serial numbers if provided
    const addedSerials: SerialNumberItem[] = newSerialNumbers.map((sn) => ({
      serialNumber: sn.trim(),
      status: 'In Stock',
      location: product.storageLocation,
      dateLogged: new Date().toISOString().split('T')[0],
    }));

    const updatedSerialNumbers = [...(product.serialNumbers || []), ...addedSerials];

    const updatedProduct: Product = {
      ...product,
      stockQuantity: newQuantity,
      quantity: newQuantity,
      status: newStatus,
      serialNumbers: updatedSerialNumbers,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const newTransaction: InventoryTransaction = {
      id: `tx-${Date.now()}`,
      timestamp: dateFormatted,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantityChange: quantity, // e.g. +5
      action: 'Stock In',
      reason: reason || 'Restock Inventory',
      user: user || state.currentUser,
      notes: notes || `Restocked ${quantity} unit(s). Stock increased from ${product.stockQuantity} to ${newQuantity}.`,
      serialNumbers: newSerialNumbers,
      resultingQuantity: newQuantity,
    };

    set({
      products: state.products.map((p) => (p.id === productId ? updatedProduct : p)),
      transactions: [newTransaction, ...state.transactions], // Historical transactions NEVER erased
    });
    persistProduct(updatedProduct, 'PATCH');
    return true;
  },

  // GUARDED ACTION 4: stockOut / stockOutProduct (Defense in Depth)
  stockOut: (params) => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'stockOut');
    if (roleError) {
      const err = roleError;
      console.error(err.message);
      return err;
    }
    return get().stockOutProduct(params);
  },

  stockOutProduct: ({ productId, quantity, selectedSerialNumbers = [], reason, user, notes, date }) => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'stockOutProduct');
    if (roleError) {
      console.error(roleError.message);
      return false;
    }

    if (quantity <= 0) return false;

    const state = get();
    const product = state.products.find((p) => p.id === productId);
    if (!product || product.stockQuantity < quantity) return false;

    // Do NOT permanently delete product. Reduce quantity using Zustand store.
    const newQuantity = product.stockQuantity - quantity;
    const newStatus = getStockStatus(newQuantity, product.lowStockThreshold);
    const dateFormatted = date || new Date().toLocaleString();

    // Update statuses of the selected serial numbers to match reason
    const updatedSerialNumbers = (product.serialNumbers || []).map((sn) => {
      if (selectedSerialNumbers.includes(sn.serialNumber)) {
        return {
          ...sn,
          status: (reason === 'Sold' ? 'Sold' : reason === 'Transferred' ? 'Reserved' : 'Sold') as SerialNumberItem['status'],
          dateLogged: new Date().toISOString().split('T')[0],
        };
      }
      return sn;
    });

    const updatedProduct: Product = {
      ...product,
      stockQuantity: newQuantity,
      quantity: newQuantity,
      status: newStatus,
      serialNumbers: updatedSerialNumbers,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const newTransaction: InventoryTransaction = {
      id: `tx-${Date.now()}`,
      timestamp: dateFormatted,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantityChange: -quantity, // e.g. -2
      action: 'Stock Out',
      reason: reason,
      user: user || state.currentUser,
      notes: notes || `Stock Out of ${quantity} unit(s) for: ${reason}.`,
      serialNumbers: selectedSerialNumbers,
      resultingQuantity: newQuantity,
    };

    set({
      products: state.products.map((p) => (p.id === productId ? updatedProduct : p)),
      transactions: [newTransaction, ...state.transactions], // Historical transactions NEVER erased
    });
    persistProduct(updatedProduct, 'PATCH');
    return true;
  },

  updateStock: (productId: string, delta: number, reason?: string) => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'updateStock');
    if (roleError) {
      console.error(roleError.message);
      return;
    }
    if (delta > 0) {
      get().restockProduct({ productId, quantity: delta, reason: reason || 'Manual Stock In adjustment' });
    } else if (delta < 0) {
      get().stockOutProduct({
        productId,
        quantity: Math.abs(delta),
        reason: 'Other',
        notes: reason || 'Manual Stock Out adjustment',
      });
    }
  },

  recordStockOut: (productId: string, quantity: number, notes?: string) => {
    const roleError = getInventoryMutationError(get().currentUserRole, 'recordStockOut');
    if (roleError) {
      console.error(roleError.message);
      return false;
    }
    return get().stockOutProduct({
      productId,
      quantity,
      reason: 'Sold',
      notes,
    });
  },

  setSelectedCategory: (category: Category | null) => {
    set({
      selectedCategory: category,
      activeView: category ? 'inventory' : 'dashboard',
      isMenuOpen: false,
    });
  },

  setSelectedStatus: (status: StockStatus | 'all') => {
    set({
      selectedStatus: status,
    });
  },

  setSelectedBrand: (brand: string | 'all') => {
    set({
      selectedBrand: brand,
    });
  },

  setSelectedCondition: (condition: ProductCondition | 'all') => {
    set({
      selectedCondition: condition,
    });
  },

  setSortOption: (sort: SortOption) => {
    set({
      sortOption: sort,
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  toggleSearch: () => {
    set((state) => ({ isSearchOpen: !state.isSearchOpen }));
  },

  setMenuOpen: (open: boolean) => {
    set({ isMenuOpen: open });
  },

  clearNotificationBadge: () => {
    set({ unreadNotifications: 0 });
  },

  resetFilters: () => {
    set({
      selectedCategory: null,
      selectedStatus: 'all',
      selectedBrand: 'all',
      selectedCondition: 'all',
      sortOption: 'date_desc',
      searchQuery: '',
      isSearchOpen: false,
      activeView: 'dashboard',
      isMenuOpen: false,
      selectedProductId: null,
    });
  },

  clearLastAddedProduct: () => {
    set({ lastAddedProduct: null });
  },
}));

// Backward compatibility export
export const inventoryStore = {
  getState: () => useInventoryStore.getState(),
  getDashboardCounts: () => getDashboardCounts(useInventoryStore.getState().products),
  getInventoryValue: () => getInventoryValue(useInventoryStore.getState().products),
};
