import React, { useState, useEffect } from 'react';
import {
  Category,
  ProductCondition,
  subcategoriesByCategory,
  generateProductCode,
} from '../lib/inventory';
import { useInventoryStore } from '../store/inventoryStore';

export default function AddItemForm() {
  const { addProduct, setActiveView, setSelectedCategory, lastAddedProduct, clearLastAddedProduct } =
    useInventoryStore();

  // Form State
  const [category, setCategory] = useState<Category>('Laptop');
  const [subcategory, setSubcategory] = useState<string>(subcategoriesByCategory['Laptop'][0]);
  const [brand, setBrand] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [condition, setCondition] = useState<ProductCondition>('Brand New');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [minimumStockLevel, setMinimumStockLevel] = useState<number | string>(4);
  const [buyingPrice, setBuyingPrice] = useState<number | string>('');
  const [sellingPrice, setSellingPrice] = useState<number | string>('');
  const [productCode, setProductCode] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [storageLocation, setStorageLocation] = useState<string>('');
  const [productPhoto, setProductPhoto] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Dynamic Specs: Computing (Laptop / Desktop)
  const [cpu, setCpu] = useState<string>('');
  const [ram, setRam] = useState<string>('');
  const [ssd, setSsd] = useState<string>('');
  const [hdd, setHdd] = useState<string>('');
  const [gpu, setGpu] = useState<string>('');
  const [screenSize, setScreenSize] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');

  // Dynamic Specs: Power Solutions
  const [capacity, setCapacity] = useState<string>('');
  const [voltage, setVoltage] = useState<string>('');
  const [powerRating, setPowerRating] = useState<string>('');

  // Dynamic Specs: Accessories
  const [connectivity, setConnectivity] = useState<string>('');
  const [compatibility, setCompatibility] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Update default subcategory when category changes
  useEffect(() => {
    const available = subcategoriesByCategory[category];
    if (available && available.length > 0) {
      setSubcategory(available[0]);
    }
  }, [category]);

  // Auto-generate preview product code if brand or category changes and user hasn't typed a custom one
  const handleGenerateCode = () => {
    const generated = generateProductCode(category, brand);
    setProductCode(generated);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setErrors(current => ({ ...current, productPhoto: 'Choose a JPG, PNG, WEBP, or GIF image.' }));
      e.target.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrors(current => ({ ...current, productPhoto: 'Choose an image smaller than 4 MB.' }));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setErrors(current => ({ ...current, productPhoto: 'Unable to read the selected image.' }));
        return;
      }
      setProductPhoto(reader.result);
      setErrors(current => {
        const remaining = { ...current };
        delete remaining.productPhoto;
        return remaining;
      });
    };
    reader.onerror = () => setErrors(current => ({ ...current, productPhoto: 'Unable to read the selected image.' }));
    reader.readAsDataURL(file);
  };

  // Quick preset photos for Hawassa-Ketema hardware
  const samplePhotoPresets: Record<Category, string[]> = {
    Laptop: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500&auto=format&fit=crop&q=60',
    ],
    Desktop: [
      'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=500&auto=format&fit=crop&q=60',
    ],
    'Power Solutions': [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=500&auto=format&fit=crop&q=60',
    ],
    Accessories: [
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=500&auto=format&fit=crop&q=60',
    ],
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!brand.trim()) newErrors.brand = 'Brand is required';
    if (!model.trim()) newErrors.model = 'Model is required';
    if (!productName.trim() && !model.trim()) newErrors.productName = 'Product name is required';
    if (Number(quantity) < 0 || isNaN(Number(quantity))) {
      newErrors.quantity = 'Quantity must be 0 or higher';
    }
    if (Number(minimumStockLevel) < 0 || isNaN(Number(minimumStockLevel))) {
      newErrors.minimumStockLevel = 'Minimum stock level is required';
    }
    if (Number(sellingPrice) < 0 || isNaN(Number(sellingPrice))) {
      newErrors.sellingPrice = 'Valid selling price in ETB is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      // Scroll to first error
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    // Auto-generate product code if empty
    const finalCode = productCode.trim() || generateProductCode(category, brand);

    const displayName = productName.trim() || `${brand.trim()} ${model.trim()}`;

    // Add to Zustand inventory store
    addProduct({
      category,
      subcategory,
      brand: brand.trim(),
      model: model.trim(),
      name: displayName,
      productName: displayName,
      condition,
      stockQuantity: Number(quantity) || 0,
      quantity: Number(quantity) || 0,
      lowStockThreshold: Number(minimumStockLevel) || 4,
      minimumStockLevel: Number(minimumStockLevel) || 4,
      buyingPrice: Number(buyingPrice) || 0,
      price: Number(sellingPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      sku: finalCode,
      productCode: finalCode,
      supplier: supplier.trim() || 'Hawassa Local Vendor',
      storageLocation: storageLocation.trim() || 'Main Showroom Display',
      productPhoto,
      notes: notes.trim(),

      // Dynamic computing fields
      cpu: cpu.trim(),
      ram: ram.trim(),
      ssd: ssd.trim(),
      hdd: hdd.trim(),
      gpu: gpu.trim(),
      screenSize: screenSize.trim(),
      serialNumber: serialNumber.trim(),

      // Dynamic power fields
      capacity: capacity.trim(),
      voltage: voltage.trim(),
      powerRating: powerRating.trim(),

      // Dynamic accessories fields
      connectivity: connectivity.trim(),
      compatibility: compatibility.trim(),
    });

    setIsSubmitting(false);
    setShowSuccessToast(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setBrand('');
    setModel('');
    setProductName('');
    setQuantity(1);
    setMinimumStockLevel(4);
    setBuyingPrice('');
    setSellingPrice('');
    setProductCode('');
    setSupplier('');
    setStorageLocation('');
    setProductPhoto('');
    setNotes('');
    setCpu('');
    setRam('');
    setSsd('');
    setHdd('');
    setGpu('');
    setScreenSize('');
    setSerialNumber('');
    setCapacity('');
    setVoltage('');
    setPowerRating('');
    setConnectivity('');
    setCompatibility('');
    setErrors({});
    setShowSuccessToast(false);
    clearLastAddedProduct();
  };

  // Profit margin calculation helper
  const buyNum = Number(buyingPrice) || 0;
  const sellNum = Number(sellingPrice) || 0;
  const margin = sellNum > 0 && buyNum > 0 ? sellNum - buyNum : 0;
  const marginPct = buyNum > 0 && margin > 0 ? ((margin / buyNum) * 100).toFixed(1) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb Navigation & Header */}
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
            <span className="text-red-700">Add Item</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Add New Inventory Item
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Register new hardware, set stock levels, pricing, and technical specifications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 self-start sm:self-auto min-h-[44px]"
        >
          <span>←</span> Back to Dashboard
        </button>
      </div>

      {/* Success Notification Banner */}
      {showSuccessToast && lastAddedProduct && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-500 p-5 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold shadow">
                ✓
              </span>
              <div>
                <h3 className="text-base font-extrabold text-emerald-950">
                  Item Added Successfully to Hawassa-Ketema Inventory!
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  <span className="font-bold">{lastAddedProduct.name}</span> &bull; SKU:{' '}
                  <span className="font-mono">{lastAddedProduct.sku}</span> &bull; Stock:{' '}
                  <span className="font-bold">{lastAddedProduct.stockQuantity} units</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="text-emerald-700 hover:text-emerald-950 font-bold text-lg p-1"
            >
              &times;
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(lastAddedProduct.category);
                setActiveView('inventory');
              }}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow min-h-[40px]"
            >
              View in Inventory →
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all min-h-[40px]"
            >
              + Add Another Item
            </button>
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="px-4 py-2 text-xs font-semibold text-emerald-800 hover:underline min-h-[40px]"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Main Add Item Form */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* ================================================================ */}
        {/* SECTION 5A: CORE PRODUCT IDENTIFIERS */}
        {/* ================================================================ */}
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <span className="w-7 h-7 rounded-lg bg-red-700 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <h2 className="text-base font-extrabold text-neutral-900">
              Basic Product Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Category Field */}
            <div>
              <label
                htmlFor="item-category"
                className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5"
              >
                Category <span className="text-red-600">*</span>
              </label>
              <select
                id="item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition-all min-h-[48px]"
              >
                <option value="Laptop">💻 Laptop</option>
                <option value="Desktop">🖥️ Desktop</option>
                <option value="Power Solutions">⚡ Power Solutions</option>
                <option value="Accessories">🔧 Accessories</option>
              </select>
            </div>

            {/* Subcategory Field */}
            <div>
              <label
                htmlFor="item-subcategory"
                className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5"
              >
                Subcategory
              </label>
              <select
                id="item-subcategory"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white transition-all min-h-[48px]"
              >
                {subcategoriesByCategory[category].map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Field */}
            <div>
              <label
                htmlFor="item-brand"
                className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5"
              >
                Brand <span className="text-red-600">*</span>
              </label>
              <input
                id="item-brand"
                type="text"
                placeholder="e.g. HP, Dell, Lenovo, APC, Mercury, Apple"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={`w-full px-3.5 py-3 rounded-xl border ${
                  errors.brand ? 'border-red-500 bg-red-50/50' : 'border-neutral-300 bg-white'
                } text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition-all min-h-[48px]`}
              />
              {errors.brand && <p className="text-xs text-red-600 mt-1 font-medium">{errors.brand}</p>}
            </div>

            {/* Model Field */}
            <div>
              <label
                htmlFor="item-model"
                className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5"
              >
                Model <span className="text-red-600">*</span>
              </label>
              <input
                id="item-model"
                type="text"
                placeholder="e.g. ProBook 450 G10, OptiPlex 7000, Smart-UPS 1500"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={`w-full px-3.5 py-3 rounded-xl border ${
                  errors.model ? 'border-red-500 bg-red-50/50' : 'border-neutral-300 bg-white'
                } text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition-all min-h-[48px]`}
              />
              {errors.model && <p className="text-xs text-red-600 mt-1 font-medium">{errors.model}</p>}
            </div>

            {/* Product Name Field */}
            <div className="sm:col-span-2">
              <label
                htmlFor="item-product-name"
                className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5"
              >
                Product Name <span className="text-neutral-400 font-normal">(Auto-composed if left blank)</span>
              </label>
              <input
                id="item-product-name"
                type="text"
                placeholder={brand && model ? `${brand} ${model}` : 'e.g. HP ProBook 450 G10 15.6" Laptop'}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition-all min-h-[48px]"
              />
            </div>

            {/* Condition Options (Brand New vs Used) */}
            <div className="sm:col-span-2">
              <span className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                Condition <span className="text-red-600">*</span>
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCondition('Brand New')}
                  className={`p-3.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all min-h-[48px] active:scale-95 ${
                    condition === 'Brand New'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-md ring-2 ring-red-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  ✨ Brand New
                </button>

                <button
                  type="button"
                  onClick={() => setCondition('Used')}
                  className={`p-3.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all min-h-[48px] active:scale-95 ${
                    condition === 'Used'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-md ring-2 ring-red-600'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  🔄 Used / Refurbished
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 5B: DYNAMIC FIELDS BASED ON SELECTED CATEGORY */}
        {/* ================================================================ */}
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-red-700 text-white flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <h2 className="text-base font-extrabold text-neutral-900">
                  {category === 'Laptop' || category === 'Desktop'
                    ? 'Computing Hardware Specifications'
                    : category === 'Power Solutions'
                    ? 'Power & Electrical Specifications'
                    : 'Accessory Specifications'}
                </h2>
                <p className="text-xs text-neutral-500">
                  Dynamic fields automatically tailored for {category}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
              {category}
            </span>
          </div>

          {/* DYNAMIC CASE 1: Laptop or Desktop */}
          {(category === 'Laptop' || category === 'Desktop') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="comp-cpu" className="block text-xs font-bold text-neutral-700 mb-1">
                  CPU (Processor)
                </label>
                <input
                  id="comp-cpu"
                  type="text"
                  placeholder="e.g. Intel Core i7-1355U"
                  value={cpu}
                  onChange={(e) => setCpu(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="comp-ram" className="block text-xs font-bold text-neutral-700 mb-1">
                  RAM (Memory)
                </label>
                <input
                  id="comp-ram"
                  type="text"
                  placeholder="e.g. 16GB DDR4 / 32GB DDR5"
                  value={ram}
                  onChange={(e) => setRam(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="comp-ssd" className="block text-xs font-bold text-neutral-700 mb-1">
                  SSD Storage
                </label>
                <input
                  id="comp-ssd"
                  type="text"
                  placeholder="e.g. 512GB NVMe M.2 SSD"
                  value={ssd}
                  onChange={(e) => setSsd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="comp-hdd" className="block text-xs font-bold text-neutral-700 mb-1">
                  HDD (Optional)
                </label>
                <input
                  id="comp-hdd"
                  type="text"
                  placeholder="e.g. 1TB SATA or None"
                  value={hdd}
                  onChange={(e) => setHdd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="comp-gpu" className="block text-xs font-bold text-neutral-700 mb-1">
                  GPU (Graphics)
                </label>
                <input
                  id="comp-gpu"
                  type="text"
                  placeholder="e.g. Intel Iris Xe / RTX 3050"
                  value={gpu}
                  onChange={(e) => setGpu(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="comp-screen" className="block text-xs font-bold text-neutral-700 mb-1">
                  Screen Size
                </label>
                <input
                  id="comp-screen"
                  type="text"
                  placeholder={category === 'Laptop' ? 'e.g. 15.6" FHD IPS' : 'e.g. 24" or Tower Only'}
                  value={screenSize}
                  onChange={(e) => setScreenSize(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="comp-sn" className="block text-xs font-bold text-neutral-700 mb-1">
                  Serial Number (S/N)
                </label>
                <input
                  id="comp-sn"
                  type="text"
                  placeholder="Unique hardware device serial number"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-mono focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC CASE 2: Power Solutions */}
          {category === 'Power Solutions' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="pwr-capacity" className="block text-xs font-bold text-neutral-700 mb-1">
                  Capacity
                </label>
                <input
                  id="pwr-capacity"
                  type="text"
                  placeholder="e.g. 1500VA, 2kVA, 100Ah"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="pwr-voltage" className="block text-xs font-bold text-neutral-700 mb-1">
                  Voltage
                </label>
                <input
                  id="pwr-voltage"
                  type="text"
                  placeholder="e.g. 12V DC, 24V, 230V AC"
                  value={voltage}
                  onChange={(e) => setVoltage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="pwr-rating" className="block text-xs font-bold text-neutral-700 mb-1">
                  Power Rating
                </label>
                <input
                  id="pwr-rating"
                  type="text"
                  placeholder="e.g. 900W, 1200W Pure Sine"
                  value={powerRating}
                  onChange={(e) => setPowerRating(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC CASE 3: Accessories */}
          {category === 'Accessories' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="acc-conn" className="block text-xs font-bold text-neutral-700 mb-1">
                  Connectivity / Interface
                </label>
                <input
                  id="acc-conn"
                  type="text"
                  placeholder="e.g. USB-C, Bluetooth 5.3, HDMI 2.1, 2.4GHz Wireless"
                  value={connectivity}
                  onChange={(e) => setConnectivity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="acc-compat" className="block text-xs font-bold text-neutral-700 mb-1">
                  Compatibility
                </label>
                <input
                  id="acc-compat"
                  type="text"
                  placeholder="e.g. Windows, Mac, Universal USB, All Type-C laptops"
                  value={compatibility}
                  onChange={(e) => setCompatibility(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[44px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* SECTION 5C: INVENTORY QUANTITY & PRICING */}
        {/* ================================================================ */}
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <span className="w-7 h-7 rounded-lg bg-red-700 text-white flex items-center justify-center text-xs font-bold">
              3
            </span>
            <h2 className="text-base font-extrabold text-neutral-900">
              Stock Levels & Pricing (ETB)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Quantity */}
            <div>
              <label htmlFor="item-qty" className="block text-xs font-bold text-neutral-700 mb-1">
                Quantity in Stock <span className="text-red-600">*</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="item-qty"
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full px-3.5 py-3 rounded-xl border ${
                    errors.quantity ? 'border-red-500 bg-red-50' : 'border-neutral-300'
                  } text-sm font-black text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]`}
                />
              </div>
              {errors.quantity && <p className="text-xs text-red-600 mt-1 font-medium">{errors.quantity}</p>}
            </div>

            {/* Minimum Stock Level */}
            <div>
              <label htmlFor="item-min-stock" className="block text-xs font-bold text-neutral-700 mb-1">
                Minimum Stock Level <span className="text-red-600">*</span>
              </label>
              <input
                id="item-min-stock"
                type="number"
                min="0"
                placeholder="Alert threshold"
                value={minimumStockLevel}
                onChange={(e) => setMinimumStockLevel(e.target.value)}
                className={`w-full px-3.5 py-3 rounded-xl border ${
                  errors.minimumStockLevel ? 'border-red-500 bg-red-50' : 'border-neutral-300'
                } text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]`}
              />
              <p className="text-[10px] text-amber-700 mt-0.5">Triggers Orange Low Stock warning</p>
            </div>

            {/* Buying Price */}
            <div>
              <label htmlFor="item-buy-price" className="block text-xs font-bold text-neutral-700 mb-1">
                Buying Price (ETB)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-neutral-400">
                  Br
                </span>
                <input
                  id="item-buy-price"
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={buyingPrice}
                  onChange={(e) => setBuyingPrice(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 rounded-xl border border-neutral-300 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
                />
              </div>
            </div>

            {/* Selling Price */}
            <div>
              <label htmlFor="item-sell-price" className="block text-xs font-bold text-neutral-700 mb-1">
                Selling Price (ETB) <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-neutral-400">
                  Br
                </span>
                <input
                  id="item-sell-price"
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className={`w-full pl-9 pr-3 py-3 rounded-xl border ${
                    errors.sellingPrice ? 'border-red-500 bg-red-50' : 'border-neutral-300'
                  } text-sm font-black text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]`}
                />
              </div>
              {errors.sellingPrice && (
                <p className="text-xs text-red-600 mt-1 font-medium">{errors.sellingPrice}</p>
              )}
            </div>
          </div>

          {/* Profit Preview Badge */}
          {margin > 0 && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
              <span className="font-medium">Estimated Gross Profit Per Unit:</span>
              <span className="font-extrabold text-emerald-700">
                +ETB {margin.toLocaleString()} {marginPct ? `(${marginPct}% markup)` : ''}
              </span>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* SECTION 5D: PRODUCT CODE, SUPPLIER, LOCATION & MEDIA */}
        {/* ================================================================ */}
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <span className="w-7 h-7 rounded-lg bg-red-700 text-white flex items-center justify-center text-xs font-bold">
              4
            </span>
            <h2 className="text-base font-extrabold text-neutral-900">
              Tracking, Location & Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Product Code (with auto-generation) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="item-product-code" className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Product Code (SKU)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="text-xs font-bold text-red-700 hover:text-red-800 hover:underline flex items-center gap-1"
                >
                  ⚡ Auto Generate
                </button>
              </div>
              <input
                id="item-product-code"
                type="text"
                placeholder={generateProductCode(category, brand || 'GEN')}
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 font-mono text-sm uppercase text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Leave blank to auto-generate unique Hawassa-Ketema SKU on save.
              </p>
            </div>

            {/* Supplier Field */}
            <div>
              <label htmlFor="item-supplier" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Supplier
              </label>
              <input
                id="item-supplier"
                type="text"
                placeholder="e.g. Addis IT Imports PLC, Ethio Computer Center"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-sm text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
              />
            </div>

            {/* Storage Location Field */}
            <div>
              <label htmlFor="item-storage-location" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Storage Location
              </label>
              <input
                id="item-storage-location"
                type="text"
                placeholder="e.g. Shelf L-01, Warehouse Bay 2, Counter Display A"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-sm text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
              />
            </div>

            {/* Product Photo Upload / Presets */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Product Photo
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="photo-upload"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-300 flex items-center justify-center gap-2 min-h-[48px] flex-1 active:scale-95 transition-all"
                >
                  <span>📷</span> Upload File
                </label>

                {productPhoto && (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-neutral-300 shadow-sm flex-shrink-0">
                    <img src={productPhoto} alt="Product preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setProductPhoto('')}
                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center text-xs font-bold opacity-0 hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
              {errors.productPhoto && <p className="mt-1 text-xs font-medium text-red-600">{errors.productPhoto}</p>}

              {/* Sample Preset Selector */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-neutral-500 font-medium">Or pick sample:</span>
                {samplePhotoPresets[category]?.slice(0, 3).map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProductPhoto(url)}
                    className="w-6 h-6 rounded-md overflow-hidden border border-neutral-300 hover:border-red-600 transition-colors"
                  >
                    <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Notes Field */}
            <div className="sm:col-span-2">
              <label htmlFor="item-notes" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Notes & Additional Remarks
              </label>
              <textarea
                id="item-notes"
                rows={3}
                placeholder="Warranty duration, cosmetic condition notes, accessories included, customer booking info..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SUBMIT BUTTONS (Large, Easy to Tap, Mobile-First) */}
        {/* ================================================================ */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-red-700 hover:bg-red-800 text-white font-extrabold text-base shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-50"
          >
            <span>+</span> Save Product to Inventory
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-bold text-sm shadow-sm active:scale-[0.98] transition-all min-h-[48px]"
          >
            Clear Form
          </button>

          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className="w-full sm:w-auto py-3.5 px-6 rounded-2xl text-neutral-600 hover:text-neutral-900 font-bold text-sm min-h-[48px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
