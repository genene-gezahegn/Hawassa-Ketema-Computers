/**
 * Hawassa-Ketema Computers - Core Inventory Business Logic
 * Master Spec - Section 2, 3, 4, 5, 7, 12, 14
 */

export type Category = 'Laptop' | 'Desktop' | 'Power Solutions' | 'Accessories';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type ProductCondition = 'Brand New' | 'Used';

export interface SerialNumberItem {
  serialNumber: string;
  status: 'In Stock' | 'Sold' | 'Reserved';
  location?: string;
  dateLogged?: string;
}

export interface Product {
  id: string;
  sku: string; // Product Code
  productCode?: string; // Alias
  name: string;
  productName?: string; // Alias
  brand: string;
  category: Category;
  subcategory?: string;
  model: string;
  condition: ProductCondition;
  specs: string;
  price: number; // Selling Price in ETB
  sellingPrice?: number; // Alias
  buyingPrice: number; // Buying Price in ETB
  stockQuantity: number; // Quantity
  quantity?: number; // Alias
  lowStockThreshold: number; // Minimum Stock Level
  minimumStockLevel?: number; // Alias
  supplier?: string;
  storageLocation?: string;
  productPhoto?: string;
  notes?: string;

  // Dynamic Specs: Computing (Laptop / Desktop)
  cpu?: string;
  ram?: string;
  ssd?: string;
  hdd?: string;
  gpu?: string;
  screenSize?: string;
  serialNumber?: string;
  serialNumbers?: SerialNumberItem[]; // Section 7 Serial Number Tracking

  // Dynamic Specs: Power Solutions
  capacity?: string;
  voltage?: string;
  powerRating?: string;

  // Dynamic Specs: Accessories
  connectivity?: string;
  compatibility?: string;

  status?: StockStatus;
  dateAdded?: string; // Alias for updatedAt
  updatedAt?: string;
}

export interface DashboardCounts {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  total?: number;
}

/**
 * Predefined subcategories per main category
 */
export const subcategoriesByCategory: Record<Category, string[]> = {
  'Laptop': [
    'Business Laptop',
    'Ultrabook',
    'Gaming Laptop',
    '2-in-1 Convertible',
    'Mobile Workstation',
    'Budget / Student',
  ],
  'Desktop': [
    'Tower Desktop',
    'Small Form Factor (SFF)',
    'All-in-One PC',
    'Gaming Desktop',
    'Workstation',
    'Mini PC',
  ],
  'Power Solutions': [
    'Line-Interactive UPS',
    'Online Double-Conversion UPS',
    'Solar Hybrid Inverter',
    'Pure Sine Wave Inverter',
    'Deep Cycle AGM Battery',
    'Lithium LiFePO4 Battery',
    'Automatic Voltage Regulator (AVR)',
  ],
  'Accessories': [
    'Monitor / Display',
    'Keyboard & Mouse',
    'USB-C Multiport Hub',
    'External SSD / Hard Drive',
    'Flash Drive / USB',
    'Laptop Charger & Adapter',
    'Laptop Bag & Sleeve',
    'Networking & Cables',
  ],
};

/**
 * Calculates stock status based on current quantity and low stock threshold.
 * - Out of Stock (Red): quantity <= 0
 * - Low Stock (Orange): quantity <= threshold
 * - In Stock (Green): quantity > threshold
 */
export function calculateStockStatus(quantity: number, threshold: number = 5): StockStatus {
  if (quantity <= 0) {
    return 'out_of_stock';
  }
  if (quantity <= threshold) {
    return 'low_stock';
  }
  return 'in_stock';
}

/**
 * getStockStatus - Master Spec Section 12 required function
 * Computes the stock status of a product or based on quantity & threshold
 */
export function getStockStatus(productOrQuantity: Product | number, threshold: number = 5): StockStatus {
  if (typeof productOrQuantity === 'number') {
    return calculateStockStatus(productOrQuantity, threshold);
  }
  const qty = productOrQuantity.stockQuantity ?? productOrQuantity.quantity ?? 0;
  const thresh = productOrQuantity.lowStockThreshold ?? productOrQuantity.minimumStockLevel ?? 5;
  return calculateStockStatus(qty, thresh);
}

export interface InventoryValueSummary {
  totalBuyingValue: number;
  totalSalesValue: number;
  potentialMargin: number;
  potentialMarginPercentage: string;
}

/**
 * Calculates store inventory valuation.
 * Master Spec Section 17 requirement:
 * - Total Buying Value (Quantity × Buying Price)
 * - Potential Sales Value (Quantity × Selling Price)
 * - Potential Margin (Potential Sales Value - Total Buying Value)
 * Note: Clearly labeled as "Potential Margin", NEVER "Profit".
 */
export function getInventoryValue(products: Product[]): InventoryValueSummary {
  const totalBuyingValue = products.reduce((sum, p) => {
    const buying = p.buyingPrice ?? p.price * 0.8;
    return sum + p.stockQuantity * buying;
  }, 0);

  const totalSalesValue = products.reduce((sum, p) => {
    const selling = p.sellingPrice ?? p.price;
    return sum + p.stockQuantity * selling;
  }, 0);

  const potentialMargin = totalSalesValue - totalBuyingValue;
  const potentialMarginPercentage =
    totalBuyingValue > 0 ? ((potentialMargin / totalBuyingValue) * 100).toFixed(1) : '0';

  return {
    totalBuyingValue,
    totalSalesValue,
    potentialMargin,
    potentialMarginPercentage,
  };
}

/**
 * Generates a unique product code automatically if not provided.
 * Follows Hawassa-Ketema Computers SKU standard format: HK-<CATEGORY>-<BRAND>-<UNIQUE_ID>
 * e.g. HK-LAP-HP-4891, HK-PWR-APC-8432, HK-DSK-DEL-2384
 */
export function generateProductCode(category?: Category, brand?: string): string {
  const prefixMap: Record<Category, string> = {
    'Laptop': 'LAP',
    'Desktop': 'DSK',
    'Power Solutions': 'PWR',
    'Accessories': 'ACC',
  };

  const catCode = category && prefixMap[category] ? prefixMap[category] : 'ITM';
  const cleanBrand = brand ? brand.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) : '';
  const brandCode = cleanBrand.length > 0 ? cleanBrand : 'GEN';
  const timestampNum = Date.now().toString().slice(-4);
  const randomNum = Math.floor(10 + Math.random() * 90);

  return `HK-${catCode}-${brandCode}-${timestampNum}${randomNum}`;
}

/**
 * Default sample inventory representing Hawassa-Ketema Computers with individual serial numbers
 */
export const defaultInventory: Product[] = [
  // 💻 Laptop
  {
    id: 'prod-001',
    sku: 'HK-LAP-HP-1011',
    productCode: 'HK-LAP-HP-1011',
    name: 'HP ProBook 450 G10',
    productName: 'HP ProBook 450 G10',
    brand: 'HP',
    category: 'Laptop',
    subcategory: 'Business Laptop',
    model: 'ProBook 450 G10',
    condition: 'Brand New',
    specs: 'Intel Core i7-1355U, 16GB DDR4, 512GB NVMe SSD, 15.6" FHD IPS',
    cpu: 'Intel Core i7-1355U (10 Cores, up to 5.0GHz)',
    ram: '16GB DDR4-3200MHz',
    ssd: '512GB PCIe NVMe SSD',
    hdd: 'None',
    gpu: 'Intel Iris Xe Graphics',
    screenSize: '15.6" FHD (1920x1080) Anti-glare',
    serialNumber: '5CD34199KL',
    serialNumbers: [
      { serialNumber: '5CD34199KL-01', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-02', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-03', status: 'In Stock', location: 'Showroom Glass 1', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-04', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-05', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-06', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-07', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-08', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-09', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-10', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-11', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-12', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-13', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-14', status: 'In Stock', location: 'Shelf L-01', dateLogged: '2026-11-01' },
      { serialNumber: '5CD34199KL-SOLD1', status: 'Sold', location: 'Hawassa University CS Dept', dateLogged: '2026-10-25' },
    ],
    buyingPrice: 82000,
    price: 94500,
    sellingPrice: 94500,
    stockQuantity: 14,
    quantity: 14,
    lowStockThreshold: 4,
    minimumStockLevel: 4,
    supplier: 'Addis IT Imports PLC',
    storageLocation: 'Shelf L-01 (Main Showroom)',
    productPhoto: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'Official HP factory packaging. 1-year warranty certificate included in box.',
    dateAdded: '2026-10-15',
    updatedAt: '2026-11-01',
  },
  {
    id: 'prod-002',
    sku: 'HK-LAP-DEL-1012',
    productCode: 'HK-LAP-DEL-1012',
    name: 'Dell Latitude 5430',
    productName: 'Dell Latitude 5430',
    brand: 'Dell',
    category: 'Laptop',
    subcategory: 'Business Laptop',
    model: 'Latitude 5430',
    condition: 'Brand New',
    specs: 'Intel Core i5-1235U, 16GB RAM, 256GB SSD, 14.0" Anti-Glare',
    cpu: 'Intel Core i5-1235U',
    ram: '16GB DDR4',
    ssd: '256GB PCIe NVMe SSD',
    hdd: 'None',
    gpu: 'Intel Iris Xe',
    screenSize: '14.0" FHD',
    serialNumber: 'CN-08R21F-72872',
    serialNumbers: [
      { serialNumber: 'CN-08R21F-72872-01', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
      { serialNumber: 'CN-08R21F-72872-02', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
      { serialNumber: 'CN-08R21F-72872-03', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
      { serialNumber: 'CN-08R21F-72872-04', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
      { serialNumber: 'CN-08R21F-72872-05', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
      { serialNumber: 'CN-08R21F-72872-06', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
      { serialNumber: 'CN-08R21F-72872-07', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
      { serialNumber: 'CN-08R21F-72872-08', status: 'In Stock', location: 'Shelf L-02', dateLogged: '2026-11-01' },
    ],
    buyingPrice: 68000,
    price: 78000,
    sellingPrice: 78000,
    stockQuantity: 8,
    quantity: 8,
    lowStockThreshold: 3,
    minimumStockLevel: 3,
    supplier: 'Ethio Computer Center',
    storageLocation: 'Shelf L-02',
    productPhoto: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'Rugged enterprise edition.',
    dateAdded: '2026-10-18',
    updatedAt: '2026-11-01',
  },
  {
    id: 'prod-003',
    sku: 'HK-LAP-LEN-1013',
    productCode: 'HK-LAP-LEN-1013',
    name: 'Lenovo ThinkPad E14 Gen 5',
    productName: 'Lenovo ThinkPad E14 Gen 5',
    brand: 'Lenovo',
    category: 'Laptop',
    subcategory: 'Business Laptop',
    model: 'ThinkPad E14 Gen 5',
    condition: 'Brand New',
    specs: 'AMD Ryzen 7 7730U, 16GB DDR4, 512GB SSD, 14" WUXGA IPS',
    cpu: 'AMD Ryzen 7 7730U',
    ram: '16GB DDR4',
    ssd: '512GB NVMe SSD',
    hdd: 'None',
    gpu: 'AMD Radeon Graphics',
    screenSize: '14.0" WUXGA IPS',
    serialNumber: 'PF3E9821',
    serialNumbers: [
      { serialNumber: 'PF3E9821-A', status: 'In Stock', location: 'Shelf L-03', dateLogged: '2026-11-02' },
      { serialNumber: 'PF3E9821-B', status: 'In Stock', location: 'Shelf L-03', dateLogged: '2026-11-02' },
      { serialNumber: 'PF3E9821-C', status: 'Sold', location: 'Customer Walk-in', dateLogged: '2026-11-01' },
    ],
    buyingPrice: 74000,
    price: 86000,
    sellingPrice: 86000,
    stockQuantity: 2,
    quantity: 2,
    lowStockThreshold: 4,
    minimumStockLevel: 4,
    supplier: 'Red Sea Global Trade',
    storageLocation: 'Shelf L-03',
    productPhoto: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
    status: 'low_stock',
    notes: 'Low stock warning! 2 units remaining.',
    dateAdded: '2026-10-20',
    updatedAt: '2026-11-02',
  },
  {
    id: 'prod-004',
    sku: 'HK-LAP-APP-1014',
    productCode: 'HK-LAP-APP-1014',
    name: 'Apple MacBook Air M2',
    productName: 'Apple MacBook Air M2',
    brand: 'Apple',
    category: 'Laptop',
    subcategory: 'Ultrabook',
    model: 'MacBook Air M2 2023',
    condition: 'Brand New',
    specs: 'Apple M2 8-core CPU / 8-core GPU, 8GB RAM, 256GB SSD, 13.6" Liquid Retina',
    cpu: 'Apple M2 (8-core CPU, 8-core GPU)',
    ram: '8GB Unified Memory',
    ssd: '256GB Apple Fast SSD',
    hdd: 'None',
    gpu: 'Apple M2 8-Core GPU',
    screenSize: '13.6" Liquid Retina Display',
    serialNumber: 'C02TJ0AA0891',
    serialNumbers: [
      { serialNumber: 'C02TJ0AA0891-01', status: 'Sold', location: 'Hawassa Media Hub', dateLogged: '2026-10-28' },
      { serialNumber: 'C02TJ0AA0891-02', status: 'Sold', location: 'Private Client', dateLogged: '2026-10-30' },
    ],
    buyingPrice: 118000,
    price: 135000,
    sellingPrice: 135000,
    stockQuantity: 0,
    quantity: 0,
    lowStockThreshold: 2,
    minimumStockLevel: 2,
    supplier: 'Dubai Express Logistics',
    storageLocation: 'Secure Safe A',
    productPhoto: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=80',
    status: 'out_of_stock',
    notes: 'Completely sold out. Urgent customer backorders pending.',
    dateAdded: '2026-10-10',
    updatedAt: '2026-10-30',
  },

  // 🖥️ Desktop
  {
    id: 'prod-005',
    sku: 'HK-DSK-DEL-2011',
    productCode: 'HK-DSK-DEL-2011',
    name: 'Dell OptiPlex 7000 Tower',
    productName: 'Dell OptiPlex 7000 Tower',
    brand: 'Dell',
    category: 'Desktop',
    subcategory: 'Tower Desktop',
    model: 'OptiPlex 7000 MT',
    condition: 'Brand New',
    specs: 'Intel Core i7-12700, 16GB DDR5, 512GB SSD + 1TB HDD, Intel UHD 770',
    cpu: 'Intel Core i7-12700 (12 Cores, 25MB Cache)',
    ram: '16GB DDR5 4800MHz',
    ssd: '512GB PCIe M.2 SSD',
    hdd: '1TB SATA 7200RPM',
    gpu: 'Intel UHD Graphics 770',
    screenSize: 'Tower unit only',
    serialNumber: 'DL7000-88124',
    serialNumbers: [
      { serialNumber: 'DL7000-88124-01', status: 'In Stock', location: 'Bay D-01', dateLogged: '2026-11-01' },
      { serialNumber: 'DL7000-88124-02', status: 'In Stock', location: 'Bay D-01', dateLogged: '2026-11-01' },
      { serialNumber: 'DL7000-88124-03', status: 'In Stock', location: 'Bay D-01', dateLogged: '2026-11-01' },
      { serialNumber: 'DL7000-88124-04', status: 'In Stock', location: 'Bay D-01', dateLogged: '2026-11-01' },
      { serialNumber: 'DL7000-88124-05', status: 'In Stock', location: 'Bay D-01', dateLogged: '2026-11-01' },
      { serialNumber: 'DL7000-88124-06', status: 'In Stock', location: 'Bay D-01', dateLogged: '2026-11-01' },
      { serialNumber: 'DL7000-88124-07', status: 'In Stock', location: 'Bay D-01', dateLogged: '2026-11-01' },
    ],
    buyingPrice: 91000,
    price: 105000,
    sellingPrice: 105000,
    stockQuantity: 7,
    quantity: 7,
    lowStockThreshold: 3,
    minimumStockLevel: 3,
    supplier: 'Ethio Computer Center',
    storageLocation: 'Warehouse Bay D-01',
    productPhoto: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'Includes Dell wired keyboard & optical mouse.',
    dateAdded: '2026-10-22',
    updatedAt: '2026-11-01',
  },
  {
    id: 'prod-006',
    sku: 'HK-DSK-HP-2012',
    productCode: 'HK-DSK-HP-2012',
    name: 'HP ProDesk 400 G9 Microtower',
    productName: 'HP ProDesk 400 G9 Microtower',
    brand: 'HP',
    category: 'Desktop',
    subcategory: 'Tower Desktop',
    model: 'ProDesk 400 G9',
    condition: 'Brand New',
    specs: 'Intel Core i5-12500, 8GB DDR4, 512GB SSD, FreeDOS',
    cpu: 'Intel Core i5-12500',
    ram: '8GB DDR4',
    ssd: '512GB SSD',
    hdd: 'None',
    gpu: 'Intel UHD Graphics 770',
    screenSize: 'Tower only',
    serialNumber: 'HP400G9-3321',
    serialNumbers: [
      { serialNumber: 'HP400G9-3321-01', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-02', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-03', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-04', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-05', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-06', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-07', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-08', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
      { serialNumber: 'HP400G9-3321-09', status: 'In Stock', location: 'Bay D-02', dateLogged: '2026-10-29' },
    ],
    buyingPrice: 59000,
    price: 69000,
    sellingPrice: 69000,
    stockQuantity: 9,
    quantity: 9,
    lowStockThreshold: 4,
    minimumStockLevel: 4,
    supplier: 'Addis IT Imports PLC',
    storageLocation: 'Warehouse Bay D-02',
    productPhoto: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'Popular model for bank & corporate office setups.',
    dateAdded: '2026-10-24',
    updatedAt: '2026-10-29',
  },
  {
    id: 'prod-007',
    sku: 'HK-DSK-HP-2013',
    productCode: 'HK-DSK-HP-2013',
    name: 'HP 24 All-in-One PC',
    productName: 'HP 24 All-in-One PC',
    brand: 'HP',
    category: 'Desktop',
    subcategory: 'All-in-One PC',
    model: '24-cb1000nh',
    condition: 'Used',
    specs: 'Intel Core i5-1235U, 16GB RAM, 512GB SSD, 23.8" FHD IPS Touch Screen',
    cpu: 'Intel Core i5-1235U',
    ram: '16GB DDR4',
    ssd: '512GB SSD',
    hdd: 'None',
    gpu: 'Intel Iris Xe',
    screenSize: '23.8" FHD IPS Touch Display',
    serialNumber: 'HP24AIO-9871',
    serialNumbers: [
      { serialNumber: 'HP24AIO-9871-01', status: 'In Stock', location: 'Showroom Counter A', dateLogged: '2026-11-02' },
      { serialNumber: 'HP24AIO-9871-02', status: 'In Stock', location: 'Showroom Counter A', dateLogged: '2026-11-02' },
    ],
    buyingPrice: 80000,
    price: 92000,
    sellingPrice: 92000,
    stockQuantity: 2,
    quantity: 2,
    lowStockThreshold: 3,
    minimumStockLevel: 3,
    supplier: 'Addis IT Imports PLC',
    storageLocation: 'Showroom Counter A',
    productPhoto: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80',
    status: 'low_stock',
    notes: 'Touchscreen demo display unit.',
    dateAdded: '2026-10-26',
    updatedAt: '2026-11-02',
  },

  // ⚡ Power Solutions
  {
    id: 'prod-008',
    sku: 'HK-PWR-APC-3011',
    productCode: 'HK-PWR-APC-3011',
    name: 'APC Smart-UPS 1500VA LCD 230V',
    productName: 'APC Smart-UPS 1500VA LCD 230V',
    brand: 'APC',
    category: 'Power Solutions',
    subcategory: 'Line-Interactive UPS',
    model: 'SMT1500I',
    condition: 'Brand New',
    specs: '1000W / 1500VA, Pure Sine Wave, 8 IEC Outlets, SmartSlot, LCD Display',
    capacity: '1500VA / 1000W',
    voltage: '230V AC',
    powerRating: '1000 Watts (Pure Sine Wave)',
    serialNumber: 'APC-SMT15-0982',
    serialNumbers: [
      { serialNumber: 'APC-SMT15-0982-1', status: 'In Stock', location: 'Power Bay P-01', dateLogged: '2026-11-01' },
      { serialNumber: 'APC-SMT15-0982-2', status: 'In Stock', location: 'Power Bay P-01', dateLogged: '2026-11-01' },
      { serialNumber: 'APC-SMT15-0982-3', status: 'In Stock', location: 'Power Bay P-01', dateLogged: '2026-11-01' },
      { serialNumber: 'APC-SMT15-0982-4', status: 'In Stock', location: 'Power Bay P-01', dateLogged: '2026-11-01' },
      { serialNumber: 'APC-SMT15-0982-5', status: 'In Stock', location: 'Power Bay P-01', dateLogged: '2026-11-01' },
    ],
    buyingPrice: 53000,
    price: 62000,
    sellingPrice: 62000,
    stockQuantity: 5,
    quantity: 5,
    lowStockThreshold: 2,
    minimumStockLevel: 2,
    supplier: 'Schneider Electric Regional Partner',
    storageLocation: 'Power Section P-01',
    productPhoto: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'Essential for server racks & high-end desktop workstations.',
    dateAdded: '2026-10-14',
    updatedAt: '2026-11-01',
  },
  {
    id: 'prod-009',
    sku: 'HK-PWR-MER-3012',
    productCode: 'HK-PWR-MER-3012',
    name: 'Mercury Elite 1200 Pro Offline UPS',
    productName: 'Mercury Elite 1200 Pro Offline UPS',
    brand: 'Mercury',
    category: 'Power Solutions',
    subcategory: 'Line-Interactive UPS',
    model: 'Elite 1200 Pro',
    condition: 'Brand New',
    specs: '1200VA / 720W, Line Interactive, Built-in AVR, 3 Universal Sockets',
    capacity: '1200VA / 720W',
    voltage: '220V - 240V',
    powerRating: '720 Watts',
    serialNumber: 'MER-ELITE-7721',
    serialNumbers: [
      { serialNumber: 'MER-ELITE-7721-01', status: 'In Stock', location: 'Power Section P-02', dateLogged: '2026-11-02' },
    ],
    buyingPrice: 15500,
    price: 18500,
    sellingPrice: 18500,
    stockQuantity: 1,
    quantity: 1,
    lowStockThreshold: 3,
    minimumStockLevel: 3,
    supplier: 'Mercury Distributors Ethiopia',
    storageLocation: 'Power Section P-02',
    productPhoto: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    status: 'low_stock',
    notes: '1 unit left. Customers frequently request for point-of-sale systems.',
    dateAdded: '2026-10-19',
    updatedAt: '2026-11-02',
  },
  {
    id: 'prod-010',
    sku: 'HK-PWR-LUM-3013',
    productCode: 'HK-PWR-LUM-3013',
    name: 'Luminous Solar Hybrid Inverter 1.5kVA',
    productName: 'Luminous Solar Hybrid Inverter 1.5kVA',
    brand: 'Luminous',
    category: 'Power Solutions',
    subcategory: 'Solar Hybrid Inverter',
    model: 'Solarverter PRO 1.5kVA',
    condition: 'Brand New',
    specs: '1500VA / 24V Pure Sine Wave, Solar MPPT Charger, Grid & Battery Priority',
    capacity: '1.5kVA / 24V',
    voltage: '24V DC to 230V AC',
    powerRating: '1200 Watts Pure Sine Wave',
    serialNumber: 'LUM-15K-8811',
    serialNumbers: [
      { serialNumber: 'LUM-15K-8811-01', status: 'In Stock', location: 'Power Section P-03', dateLogged: '2026-10-28' },
      { serialNumber: 'LUM-15K-8811-02', status: 'In Stock', location: 'Power Section P-03', dateLogged: '2026-10-28' },
      { serialNumber: 'LUM-15K-8811-03', status: 'In Stock', location: 'Power Section P-03', dateLogged: '2026-10-28' },
      { serialNumber: 'LUM-15K-8811-04', status: 'In Stock', location: 'Power Section P-03', dateLogged: '2026-10-28' },
    ],
    buyingPrice: 42000,
    price: 49000,
    sellingPrice: 49000,
    stockQuantity: 4,
    quantity: 4,
    lowStockThreshold: 2,
    minimumStockLevel: 2,
    supplier: 'SolarTech Addis',
    storageLocation: 'Power Section P-03',
    productPhoto: 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'High demand in Hawassa residential and medical lab zones.',
    dateAdded: '2026-10-21',
    updatedAt: '2026-10-28',
  },
  {
    id: 'prod-011',
    sku: 'HK-PWR-RIT-3014',
    productCode: 'HK-PWR-RIT-3014',
    name: 'Ritar Deep Cycle AGM Battery 12V 100Ah',
    productName: 'Ritar Deep Cycle AGM Battery 12V 100Ah',
    brand: 'Ritar',
    category: 'Power Solutions',
    subcategory: 'Deep Cycle AGM Battery',
    model: 'DC12-100',
    condition: 'Brand New',
    specs: '12V 100Ah Sealed Maintenance Free Deep Cycle Battery',
    capacity: '100Ah',
    voltage: '12 Volts DC',
    powerRating: '1200 Watt-hours',
    serialNumber: 'RIT-100AH-3301',
    serialNumbers: [
      { serialNumber: 'RIT-100AH-3301-A', status: 'Sold', location: 'Sold to Telecom Tower', dateLogged: '2026-10-29' },
    ],
    buyingPrice: 30000,
    price: 36000,
    sellingPrice: 36000,
    stockQuantity: 0,
    quantity: 0,
    lowStockThreshold: 2,
    minimumStockLevel: 2,
    supplier: 'SolarTech Addis',
    storageLocation: 'Heavy Goods Yard B',
    productPhoto: 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800&auto=format&fit=crop&q=80',
    status: 'out_of_stock',
    notes: 'Out of stock. Container arrival scheduled from Djibouti next week.',
    dateAdded: '2026-10-12',
    updatedAt: '2026-11-01',
  },

  // 🔧 Accessories
  {
    id: 'prod-012',
    sku: 'HK-ACC-LOG-4011',
    productCode: 'HK-ACC-LOG-4011',
    name: 'Logitech MX Master 3S Wireless Mouse',
    productName: 'Logitech MX Master 3S Wireless Mouse',
    brand: 'Logitech',
    category: 'Accessories',
    subcategory: 'Keyboard & Mouse',
    model: 'MX Master 3S',
    condition: 'Brand New',
    specs: '8K DPI Any-surface Tracking, Quiet Clicks, MagSpeed Scroll, Bluetooth/USB',
    connectivity: 'Bluetooth Low Energy & Logi Bolt USB Receiver',
    compatibility: 'Windows, macOS, Linux, iPadOS, Android',
    serialNumber: 'LOG-MX3S-9901',
    buyingPrice: 10200,
    price: 12500,
    sellingPrice: 12500,
    stockQuantity: 16,
    quantity: 16,
    lowStockThreshold: 5,
    minimumStockLevel: 5,
    supplier: 'Global IT Hardware Co.',
    storageLocation: 'Accessories Shelf A-01',
    productPhoto: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'Top seller among programmers and video editors.',
    dateAdded: '2026-10-25',
    updatedAt: '2026-11-02',
  },
  {
    id: 'prod-013',
    sku: 'HK-ACC-DEL-4012',
    productCode: 'HK-ACC-DEL-4012',
    name: 'Dell 24" FHD Monitor (SE2422H)',
    productName: 'Dell 24" FHD Monitor (SE2422H)',
    brand: 'Dell',
    category: 'Accessories',
    subcategory: 'Monitor / Display',
    model: 'SE2422H',
    condition: 'Used',
    specs: '23.8" Full HD (1920 x 1080) 75Hz, VA Panel, HDMI/VGA, AMD FreeSync',
    screenSize: '23.8 inches',
    connectivity: 'HDMI 1.4, VGA',
    compatibility: 'All PCs & Laptops',
    serialNumber: 'CN-0M381P-74261',
    serialNumbers: [
      { serialNumber: 'CN-0M381P-74261-01', status: 'In Stock', location: 'Display Area C', dateLogged: '2026-11-02' },
      { serialNumber: 'CN-0M381P-74261-02', status: 'In Stock', location: 'Display Area C', dateLogged: '2026-11-02' },
      { serialNumber: 'CN-0M381P-74261-03', status: 'In Stock', location: 'Display Area C', dateLogged: '2026-11-02' },
    ],
    buyingPrice: 20500,
    price: 24500,
    sellingPrice: 24500,
    stockQuantity: 3,
    quantity: 3,
    lowStockThreshold: 5,
    minimumStockLevel: 5,
    supplier: 'Ethio Computer Center',
    storageLocation: 'Display Area C',
    productPhoto: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
    status: 'low_stock',
    notes: 'Low stock. Fast turnover item.',
    dateAdded: '2026-10-27',
    updatedAt: '2026-11-02',
  },
  {
    id: 'prod-014',
    sku: 'HK-ACC-KIN-4013',
    productCode: 'HK-ACC-KIN-4013',
    name: 'Kingston DataTraveler 64GB USB 3.2',
    productName: 'Kingston DataTraveler 64GB USB 3.2',
    brand: 'Kingston',
    category: 'Accessories',
    subcategory: 'Flash Drive / USB',
    model: 'DTX/64GB',
    condition: 'Brand New',
    specs: '64GB USB 3.2 Gen 1 Flash Drive, Protective Cap & Keyring Loop',
    capacity: '64 GB',
    connectivity: 'USB 3.2 Gen 1 (USB 3.0)',
    compatibility: 'Universal USB-A',
    buyingPrice: 700,
    price: 950,
    sellingPrice: 950,
    stockQuantity: 38,
    quantity: 38,
    lowStockThreshold: 10,
    minimumStockLevel: 10,
    supplier: 'Addis Accessories Hub',
    storageLocation: 'Accessories Counter Bin 2',
    productPhoto: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'High retail volume.',
    dateAdded: '2026-10-20',
    updatedAt: '2026-10-31',
  },
  {
    id: 'prod-015',
    sku: 'HK-ACC-UGR-4014',
    productCode: 'HK-ACC-UGR-4014',
    name: 'USB-C 8-in-1 Multiport Adapter Hub',
    productName: 'USB-C 8-in-1 Multiport Adapter Hub',
    brand: 'Ugreen',
    category: 'Accessories',
    subcategory: 'USB-C Multiport Hub',
    model: 'CM418',
    condition: 'Brand New',
    specs: '4K HDMI, 100W PD charging, 3x USB 3.0, Gigabit Ethernet, SD/TF Card Reader',
    connectivity: 'USB Type-C',
    compatibility: 'MacBook, Dell XPS, HP, Lenovo & Windows Type-C Laptops',
    buyingPrice: 4600,
    price: 5800,
    sellingPrice: 5800,
    stockQuantity: 11,
    quantity: 11,
    lowStockThreshold: 4,
    minimumStockLevel: 4,
    supplier: 'Global IT Hardware Co.',
    storageLocation: 'Accessories Shelf A-03',
    productPhoto: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&auto=format&fit=crop&q=80',
    status: 'in_stock',
    notes: 'Essential pairing for modern USB-C laptops.',
    dateAdded: '2026-10-23',
    updatedAt: '2026-11-02',
  },
];

/**
 * Returns dashboard summary counts for inventory: Total, In Stock, Low Stock, and Out of Stock.
 * Connected directly to the Main Dashboard summary cards.
 */
export function getDashboardCounts(products?: Product[]): DashboardCounts {
  const items = products ?? defaultInventory;
  const totalProducts = items.length;
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;

  for (const product of items) {
    const status = getStockStatus(product);
    if (status === 'in_stock') {
      inStock++;
    } else if (status === 'low_stock') {
      lowStock++;
    } else if (status === 'out_of_stock') {
      outOfStock++;
    }
  }

  return {
    totalProducts,
    inStock,
    lowStock,
    outOfStock,
    total: totalProducts,
  };
}

/**
 * Filters inventory by category.
 */
export function getProductsByCategory(category: Category, products?: Product[]): Product[] {
  const items = products ?? defaultInventory;
  return items.filter((item) => item.category === category);
}

/**
 * Searches products by query across name, brand, model, SKU, serial numbers, or specs.
 */
export function searchProducts(query: string, products?: Product[]): Product[] {
  const items = products ?? defaultInventory;
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(trimmed) ||
      item.brand.toLowerCase().includes(trimmed) ||
      item.model.toLowerCase().includes(trimmed) ||
      item.sku.toLowerCase().includes(trimmed) ||
      item.category.toLowerCase().includes(trimmed) ||
      item.specs.toLowerCase().includes(trimmed) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(trimmed)) ||
      (item.serialNumbers && item.serialNumbers.some((s) => s.serialNumber.toLowerCase().includes(trimmed)))
  );
}
