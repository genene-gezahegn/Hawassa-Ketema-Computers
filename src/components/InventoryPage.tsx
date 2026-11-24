import React, { useState, useMemo } from 'react';
import {
  Product,
  Category,
  StockStatus,
  ProductCondition,
  getStockStatus,
} from '../lib/inventory';
import { getRolePermissions, useInventoryStore, SortOption } from '../store/inventoryStore';
import { deactivateApiProduct, getUnpublishedInventoryProducts, publishUnpublishedInventory, updateApiProductPhoto } from '../lib/api';
import ProductImage from './ProductImage';

const API_PRODUCT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function InventoryPage() {
  const {
    products,
    currentUserRole,
    setProducts,
    selectedCategory,
    selectedStatus,
    selectedBrand,
    selectedCondition,
    sortOption,
    searchQuery,
    isSearchOpen,
    setSelectedCategory,
    setSelectedStatus,
    setSelectedBrand,
    setSelectedCondition,
    setSortOption,
    setSearchQuery,
    viewProductDetails,
    setActiveView,
    resetFilters,
  } = useInventoryStore();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [publishingInventory, setPublishingInventory] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [publishError, setPublishError] = useState('');
  const [productActionMessage, setProductActionMessage] = useState('');
  const [productActionError, setProductActionError] = useState('');
  const [editingImageProduct, setEditingImageProduct] = useState<Product | null>(null);
  const [imageValue, setImageValue] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [removingProduct, setRemovingProduct] = useState<string | null>(null);
  const permissions = getRolePermissions(currentUserRole);
  const unpublishedProducts = getUnpublishedInventoryProducts(products);

  const handlePublishInventory = async () => {
    setPublishingInventory(true);
    setPublishMessage('');
    setPublishError('');
    try {
      const publishedIds = await publishUnpublishedInventory(useInventoryStore.getState().products);
      const currentProducts = useInventoryStore.getState().products;
      setProducts(currentProducts.map((product) => ({
        ...product,
        id: publishedIds[product.id] || product.id,
      })));
      const publishedCount = Object.keys(publishedIds).length;
      setPublishMessage(publishedCount
        ? `Published ${publishedCount} real inventory item${publishedCount === 1 ? '' : 's'} to the customer shop.`
        : 'There are no unpublished, locally entered items to publish.');
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Unable to publish inventory.');
    } finally {
      setPublishingInventory(false);
    }
  };

  const openImageEditor = (product: Product) => {
    setEditingImageProduct(product);
    setImageValue(product.productPhoto || '');
    setProductActionError('');
    setProductActionMessage('');
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setProductActionError('Choose a JPG, PNG, WEBP, or GIF image.');
      event.target.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setProductActionError('Choose an image smaller than 4 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setProductActionError('Unable to read the selected image.');
        return;
      }
      setProductActionError('');
      setImageValue(reader.result);
    };
    reader.onerror = () => setProductActionError('Unable to read the selected image.');
    reader.readAsDataURL(file);
  };

  const handleSaveProductPhoto = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingImageProduct) return;
    setSavingImage(true);
    setProductActionError('');
    setProductActionMessage('');
    const productPhoto = imageValue.trim() || null;
    try {
      await updateApiProductPhoto(editingImageProduct.id, productPhoto);
      setProducts(useInventoryStore.getState().products.map(product => product.id === editingImageProduct.id
        ? { ...product, productPhoto: productPhoto || undefined }
        : product));
      setProductActionMessage(`Product image updated for ${editingImageProduct.name}.`);
      setEditingImageProduct(null);
    } catch (error) {
      setProductActionError(error instanceof Error ? error.message : 'Unable to update product image.');
    } finally {
      setSavingImage(false);
    }
  };

  const handleRemoveProduct = async (product: Product) => {
    if (!window.confirm(`Remove "${product.name}" from the customer shop? Existing order history will be preserved.`)) return;
    setRemovingProduct(product.id);
    setProductActionError('');
    setProductActionMessage('');
    try {
      await deactivateApiProduct(product.id);
      setProducts(useInventoryStore.getState().products.filter(item => item.id !== product.id));
      setProductActionMessage(`${product.name} was removed from the customer shop.`);
    } catch (error) {
      setProductActionError(error instanceof Error ? error.message : 'Unable to remove product.');
    } finally {
      setRemovingProduct(null);
    }
  };

  // Derive unique brands from existing inventory
  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Categories list
  const categoriesList: Category[] = ['Laptop', 'Desktop', 'Power Solutions', 'Accessories'];

  // Status badge helper
  const renderStatusBadge = (status: StockStatus) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            In Stock
          </span>
        );
      case 'low_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Low Stock
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Out of Stock
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            Neutral
          </span>
        );
    }
  };

  // Filter and Sort Products
  const processedProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Category Filter
        if (selectedCategory && p.category !== selectedCategory) {
          return false;
        }
        // Stock Status Filter (using getStockStatus)
        const status = getStockStatus(p);
        if (selectedStatus !== 'all' && status !== selectedStatus) {
          return false;
        }
        // Brand Filter
        if (selectedBrand !== 'all' && p.brand !== selectedBrand) {
          return false;
        }
        // Condition Filter
        if (selectedCondition !== 'all' && p.condition !== selectedCondition) {
          return false;
        }
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.model.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.supplier && p.supplier.toLowerCase().includes(q)) ||
            (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
            (p.serialNumbers && p.serialNumbers.some((s) => s.serialNumber.toLowerCase().includes(q))) ||
            p.specs.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'quantity_desc':
            return b.stockQuantity - a.stockQuantity;
          case 'quantity_asc':
            return a.stockQuantity - b.stockQuantity;
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'date_desc':
            return (b.dateAdded || b.updatedAt || '').localeCompare(a.dateAdded || a.updatedAt || '');
          case 'date_asc':
            return (a.dateAdded || a.updatedAt || '').localeCompare(b.dateAdded || b.updatedAt || '');
          default:
            return 0;
        }
      });
  }, [products, selectedCategory, selectedStatus, selectedBrand, selectedCondition, searchQuery, sortOption]);

  const hasActiveFilters =
    Boolean(selectedCategory) ||
    selectedStatus !== 'all' ||
    selectedBrand !== 'all' ||
    selectedCondition !== 'all' ||
    Boolean(searchQuery.trim());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Header & Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-1">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="hover:text-red-700 transition-colors"
            >
              Dashboard
            </button>
            <span>/</span>
            <span className="text-red-700">All Inventory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <span>All Inventory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-800 font-bold">
              {processedProducts.length} of {products.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Search, filter, inspect specifications, and manage Hawassa-Ketema stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUserRole === 'Admin' && (
            <button
              type="button"
              onClick={handlePublishInventory}
              disabled={publishingInventory || unpublishedProducts.length === 0}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-800 font-extrabold text-xs hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
            >
              {publishingInventory ? 'Publishing...' : `Publish real items (${unpublishedProducts.length})`}
            </button>
          )}
          {/* Add Item Button */}
          {permissions.canAddProduct && <button
            type="button"
            onClick={() => setActiveView('add_item')}
            className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs shadow hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
          >
            <span className="text-sm font-bold">+</span> Add Item
          </button>}

          {/* Toggle View Mode (Cards vs Table) */}
          <div className="hidden sm:flex items-center bg-white border border-neutral-300 rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>
      {publishMessage && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{publishMessage}</p>}
      {publishError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{publishError}</p>}
      {productActionMessage && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{productActionMessage}</p>}
      {productActionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{productActionError}</p>}

      {editingImageProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="product-image-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="product-image-dialog-title" className="text-lg font-black">Product image</h2>
            <p className="mt-1 text-sm text-neutral-500">{editingImageProduct.name} · {editingImageProduct.sku}</p>
            <form onSubmit={handleSaveProductPhoto} className="mt-4 space-y-4">
              <label className="block text-xs font-bold text-neutral-700">
                Image URL
                <input
                  type="url"
                  value={imageValue.startsWith('data:image/') ? '' : imageValue}
                  onChange={event => setImageValue(event.target.value)}
                  placeholder="https://example.com/product-image.jpg"
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-neutral-700">
                Or upload an image (JPG, PNG, WEBP, GIF; max 4 MB)
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoUpload} className="mt-1 block w-full text-sm font-normal" />
              </label>
              {imageValue.startsWith('data:image/') && <p className="text-xs text-neutral-500">A local image file is selected.</p>}
              {imageValue && <img src={imageValue} alt={`Preview of ${editingImageProduct.name}`} className="max-h-56 w-full rounded-xl border border-neutral-200 object-contain" />}
              <div className="flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-4">
                <button type="button" onClick={() => setImageValue('')} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">
                  Remove image
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingImageProduct(null)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingImage} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
                    {savingImage ? 'Saving…' : 'Save image'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION 14: FILTER & SEARCH CONTROLS */}
      {/* ================================================================== */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-neutral-200 shadow-sm space-y-4">
        {/* Search Bar */}
        {!isSearchOpen && <div className="relative">
          <input
            type="text"
            placeholder="Search products by name, brand, model, SKU, serial number, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-neutral-50 border border-neutral-300 text-neutral-900 placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition-all min-h-[48px]"
          />
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 font-bold text-lg"
            >
              &times;
            </button>
          )}
        </div>}

        {/* 5 Filters Grid (Category, Brand, Condition, Stock Status, Sort) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Category Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Category
            </label>
            <select
              value={selectedCategory || 'all'}
              onChange={(e) => setSelectedCategory(e.target.value === 'all' ? null : (e.target.value as Category))}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
            >
              <option value="all">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Laptop' ? '💻' : cat === 'Desktop' ? '🖥️' : cat === 'Power Solutions' ? '⚡' : '🔧'} {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Brand Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Brand
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
            >
              <option value="all">All Brands</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Condition Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Condition
            </label>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value as ProductCondition | 'all')}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
            >
              <option value="all">All Conditions</option>
              <option value="Brand New">✨ Brand New</option>
              <option value="Used">🔄 Used</option>
            </select>
          </div>

          {/* 4. Stock Status Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Stock Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as StockStatus | 'all')}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
            >
              <option value="all">All Statuses</option>
              <option value="in_stock">🟢 In Stock</option>
              <option value="low_stock">🟠 Low Stock</option>
              <option value="out_of_stock">🔴 Out of Stock</option>
            </select>
          </div>

          {/* 5. Sort Dropdown (Quantity, Name, Date) */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Sort By
            </label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-xs font-bold focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
            >
              <option value="quantity_desc">Quantity: High to Low</option>
              <option value="quantity_asc">Quantity: Low to High</option>
              <option value="name_asc">Product Name: A to Z</option>
              <option value="name_desc">Product Name: Z to A</option>
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
            </select>
          </div>
        </div>

        {/* Active Filters Pill Bar & Reset Action */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 text-xs">
            <span className="font-bold text-neutral-500">Active Filters:</span>

            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold border border-red-200">
                Category: {selectedCategory}
                <button onClick={() => setSelectedCategory(null)} className="hover:text-red-900 font-bold">&times;</button>
              </span>
            )}

            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 font-bold border border-neutral-200">
                Status: {selectedStatus.replace('_', ' ')}
                <button onClick={() => setSelectedStatus('all')} className="hover:text-neutral-900 font-bold">&times;</button>
              </span>
            )}

            {selectedBrand !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 font-bold border border-neutral-200">
                Brand: {selectedBrand}
                <button onClick={() => setSelectedBrand('all')} className="hover:text-neutral-900 font-bold">&times;</button>
              </span>
            )}

            {selectedCondition !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 font-bold border border-neutral-200">
                Condition: {selectedCondition}
                <button onClick={() => setSelectedCondition('all')} className="hover:text-neutral-900 font-bold">&times;</button>
              </span>
            )}

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 font-bold border border-neutral-200">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-neutral-900 font-bold">&times;</button>
              </span>
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold text-red-700 hover:underline ml-auto"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION 14: PRODUCT LISTING (Each card shows Product, Brand, Model, Quantity, Condition, Status) */}
      {/* Clicking navigates to its Product Details Page */}
      {/* ================================================================== */}
      {processedProducts.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-neutral-200 space-y-3">
          <span className="text-4xl">📦</span>
          <h3 className="text-base font-extrabold text-neutral-900">No inventory products matched</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Try adjusting your search criteria, category, or stock status filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all min-h-[44px]"
          >
            Clear All Filters
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Brand</th>
                  <th className="py-3.5 px-4">Model</th>
                  <th className="py-3.5 px-4">Condition</th>
                  <th className="py-3.5 px-4">Quantity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Price (ETB)</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {processedProducts.map((p) => {
                  const status = getStockStatus(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => viewProductDetails(p.id)}
                      className="hover:bg-red-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-neutral-900 text-sm">{p.name}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">SKU: {p.sku}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-neutral-800">{p.brand}</td>
                      <td className="py-3.5 px-4 text-neutral-700">{p.model}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 font-semibold text-neutral-700 border border-neutral-200">
                          {p.condition}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-sm text-neutral-900">
                        {p.stockQuantity}
                      </td>
                      <td className="py-3.5 px-4">{renderStatusBadge(status)}</td>
                      <td className="py-3.5 px-4 text-right font-black text-sm text-neutral-900">
                        ETB {p.price.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button type="button" onClick={event => { event.stopPropagation(); viewProductDetails(p.id); }} className="text-xs font-bold text-red-700 hover:text-red-900">
                            View Details
                          </button>
                          {currentUserRole === 'Admin' && API_PRODUCT_ID.test(p.id) && (
                            <>
                              <button type="button" onClick={event => { event.stopPropagation(); openImageEditor(p); }} className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
                                {p.productPhoto ? 'Edit image' : 'Add image'}
                              </button>
                              <button type="button" disabled={removingProduct === p.id} onClick={event => { event.stopPropagation(); void handleRemoveProduct(p); }} className="rounded-md border border-red-200 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                                {removingProduct === p.id ? 'Removing…' : 'Remove'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW (Mobile-First) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processedProducts.map((product: Product) => {
            const status = getStockStatus(product);
            return (
              <div
                key={product.id}
                onClick={() => viewProductDetails(product.id)}
                role="button"
                tabIndex={0}
                className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between active:scale-[0.99] group"
              >
                <div>
                  {/* Category & Status Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      {product.category} {product.subcategory && `• ${product.subcategory}`}
                    </span>
                    {renderStatusBadge(status)}
                  </div>

                  <div className="w-full h-36 rounded-xl overflow-hidden bg-neutral-100 mb-3 border border-neutral-200">
                    <ProductImage product={product} />
                  </div>

                  {/* Product Title */}
                  <h3 className="text-base font-extrabold text-neutral-900 leading-snug group-hover:text-red-700 transition-colors">
                    {product.name}
                  </h3>

                  {/* Brand & Model */}
                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                    <span className="font-bold text-neutral-800">{product.brand}</span>
                    <span>&bull;</span>
                    <span>Model: {product.model}</span>
                  </div>

                  {/* SKU & Condition Badges */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                      {product.sku}
                    </span>
                    <span className="font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 text-[11px]">
                      {product.condition}
                    </span>
                  </div>

                  {/* Specs snippet */}
                  <p className="mt-2 text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 line-clamp-2">
                    {product.specs}
                  </p>
                </div>

                {/* Footer: Quantity & Price */}
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-bold uppercase">Quantity</span>
                    <span className="text-base font-black text-neutral-900">
                      {product.stockQuantity} {product.stockQuantity === 1 ? 'unit' : 'units'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 block font-bold uppercase">Price</span>
                    <span className="text-base font-black text-neutral-900">
                      ETB {product.price.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Tap Prompt */}
                <div className="mt-3 pt-2 text-center text-xs font-bold text-red-700 group-hover:underline">
                  View Full Product Details →
                </div>
                {currentUserRole === 'Admin' && API_PRODUCT_ID.test(product.id) && (
                  <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3" onClick={event => event.stopPropagation()}>
                    <button type="button" onClick={() => openImageEditor(product)} className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
                      {product.productPhoto ? 'Edit image' : 'Add image'}
                    </button>
                    <button type="button" disabled={removingProduct === product.id} onClick={() => void handleRemoveProduct(product)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      {removingProduct === product.id ? 'Removing…' : 'Remove product'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
