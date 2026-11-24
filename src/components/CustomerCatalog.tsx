import React from 'react';
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  Heart,
  Laptop,
  Minus,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Category, Product } from '../lib/inventory';
import ProductImage from './ProductImage';
import {
  CatalogSort,
  CustomerProfile,
  CustomerTab,
  customerCategories,
  formatCustomerPrice,
} from './customerStorefrontTypes';

interface CustomerCatalogProps {
  products: Product[];
  featuredProduct: Product;
  customer: CustomerProfile;
  activeTab: Extract<CustomerTab, 'catalog' | 'wishlist'>;
  visibleProducts: Product[];
  recentlyViewedProducts: Product[];
  cart: Record<string, number>;
  wishlist: string[];
  compareIds: string[];
  search: string;
  selectedCategory: Category | 'All';
  sortBy: CatalogSort;
  inStockOnly: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: Category | 'All') => void;
  onSortChange: (sort: CatalogSort) => void;
  onAvailabilityChange: (inStockOnly: boolean) => void;
  onToggleWishlist: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
  onUpdateCart: (product: Product, change: number) => void;
  onOpenProduct: (product: Product) => void;
  onOpenComparison: () => void;
}

export default function CustomerCatalog({
  products,
  featuredProduct,
  customer,
  activeTab,
  visibleProducts,
  recentlyViewedProducts,
  cart,
  wishlist,
  compareIds,
  search,
  selectedCategory,
  sortBy,
  inStockOnly,
  onSearchChange,
  onCategoryChange,
  onSortChange,
  onAvailabilityChange,
  onToggleWishlist,
  onToggleCompare,
  onUpdateCart,
  onOpenProduct,
  onOpenComparison,
}: CustomerCatalogProps) {
  return (
    <>
      {activeTab === 'catalog' && <>
        <section className="relative isolate min-h-[300px] sm:min-h-[360px] overflow-hidden rounded-xl bg-neutral-900 text-white mb-7">
          <div className="absolute inset-0"><ProductImage product={featuredProduct} /></div>
          <div className="absolute inset-0 bg-black/55" />
          <div className="relative z-10 min-h-[300px] sm:min-h-[360px] flex flex-col justify-end sm:justify-center items-start p-6 sm:p-10 lg:p-14 max-w-3xl">
            <p className="text-xs sm:text-sm font-bold uppercase text-white/80 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Hawassa stock, ready to explore</p>
            <h1 className="mt-3 text-3xl sm:text-5xl font-black leading-tight">Technology that works for you.</h1>
            <p className="mt-3 max-w-xl text-sm sm:text-base text-white/85">Shop computers, accessories, and power solutions with clear local pricing and listed availability.</p>
            <button type="button" onClick={() => document.getElementById('customer-catalog')?.scrollIntoView({ behavior: 'smooth' })} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-100">
              Explore the catalog <ChevronRight size={17} />
            </button>
          </div>
          <div className="absolute bottom-4 right-5 z-10 hidden sm:flex items-center gap-2 rounded-md bg-black/50 px-3 py-2 text-xs font-semibold backdrop-blur-sm">
            <Laptop size={15} /> {products.length} products in catalog
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 mb-8">
          <div className="flex items-center gap-3 bg-white px-4 py-4"><ShieldCheck size={20} className="text-emerald-700 shrink-0" /><div><p className="text-sm font-bold">Clear availability</p><p className="text-xs text-neutral-500">See current units before ordering</p></div></div>
          <div className="flex items-center gap-3 bg-white px-4 py-4"><Truck size={20} className="text-red-700 shrink-0" /><div><p className="text-sm font-bold">Local pickup</p><p className="text-xs text-neutral-500">Convenient service in Hawassa</p></div></div>
          <div className="flex items-center gap-3 bg-white px-4 py-4"><CheckCircle2 size={20} className="text-neutral-700 shrink-0" /><div><p className="text-sm font-bold">Straightforward pricing</p><p className="text-xs text-neutral-500">Prices displayed in ETB</p></div></div>
        </div>
      </>}

      <section>
        <div id="customer-catalog" className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5 scroll-mt-24">
          <div>
            <p className="text-xs font-bold uppercase text-red-700">{activeTab === 'catalog' ? 'Curated local inventory' : 'Your collection'}</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black">{activeTab === 'catalog' ? 'Find your next upgrade' : 'Saved products'}</h2>
            <p className="mt-1 text-sm text-neutral-600">{activeTab === 'catalog' ? `Signed in as ${customer.name} · ${customer.email}` : 'Your favorite products, gathered in one place.'}</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search products" className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-600" />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-3" aria-label="Product categories">
          {customerCategories.map((category) => (
            <button key={category} type="button" onClick={() => onCategoryChange(category)} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold border ${selectedCategory === category ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-neutral-300 text-neutral-700 hover:border-neutral-500'}`}>
              {category} <span className={selectedCategory === category ? 'ml-1 text-white/70' : 'ml-1 text-neutral-400'}>{category === 'All' ? products.length : products.filter((product) => product.category === category).length}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-y border-neutral-200 py-3 mb-4">
          <p className="text-xs font-semibold text-neutral-500">Showing <span className="text-neutral-900">{visibleProducts.length}</span> products</p>
          <div className="flex items-center flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">
              <input type="checkbox" checked={inStockOnly} onChange={(event) => onAvailabilityChange(event.target.checked)} className="accent-red-700" /> In stock
            </label>
            <label className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">
              <ArrowUpDown size={14} />
              <select value={sortBy} onChange={(event) => onSortChange(event.target.value as CatalogSort)} className="bg-transparent outline-none">
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </label>
            <button type="button" onClick={onOpenComparison} disabled={compareIds.length < 2} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:border-neutral-500 disabled:opacity-40" title="Select up to three products to compare">
              <Scale size={14} /> Compare{compareIds.length ? ` (${compareIds.length})` : ''}
            </button>
          </div>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="py-16 text-center bg-white border border-neutral-200 rounded-lg">
            <Heart className="mx-auto text-neutral-300" size={28} />
            <p className="mt-3 font-bold">{activeTab === 'wishlist' ? 'No saved products yet' : 'No matching products'}</p>
            <p className="mt-1 text-sm text-neutral-500">{activeTab === 'wishlist' ? 'Save products with the heart button and they will appear here.' : 'Try another search or category.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleProducts.map((product) => {
              const quantityInCart = cart[product.id] || 0;
              const available = product.stockQuantity > 0;
              const isSaved = wishlist.includes(product.id);
              const isCompared = compareIds.includes(product.id);
              return (
                <article key={product.id} className="group bg-white border border-neutral-200 rounded-lg overflow-hidden flex flex-col transition-shadow hover:shadow-lg">
                  <div className="relative h-52 bg-neutral-100 overflow-hidden">
                    <ProductImage product={product} />
                    <div className="absolute left-3 top-3"><span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${available ? 'bg-white/95 text-emerald-800' : 'bg-neutral-900/90 text-white'}`}>{available ? 'In stock' : 'Out of stock'}</span></div>
                    <div className="absolute right-3 top-3 flex gap-2">
                      <button type="button" onClick={() => onToggleWishlist(product.id)} aria-label={isSaved ? `Remove ${product.name} from saved products` : `Save ${product.name}`} aria-pressed={isSaved} title={isSaved ? 'Remove from saved' : 'Save product'} className={`h-9 w-9 rounded-full flex items-center justify-center shadow-sm ${isSaved ? 'bg-red-700 text-white' : 'bg-white/95 text-neutral-800 hover:text-red-700'}`}>
                        <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
                      </button>
                      <button type="button" onClick={() => onToggleCompare(product.id)} aria-label={isCompared ? `Remove ${product.name} from comparison` : `Compare ${product.name}`} aria-pressed={isCompared} title={compareIds.length >= 3 && !isCompared ? 'Compare up to 3 products' : isCompared ? 'Remove from comparison' : 'Add to comparison'} className={`h-9 w-9 rounded-full flex items-center justify-center shadow-sm ${isCompared ? 'bg-neutral-900 text-white' : 'bg-white/95 text-neutral-800 hover:text-red-700'}`}>
                        {isCompared ? <Check size={17} /> : <Scale size={17} />}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-[11px] font-bold uppercase text-neutral-500">{product.category} · {product.brand}</p>
                    <button type="button" onClick={() => onOpenProduct(product)} className="mt-1 text-left font-extrabold leading-snug hover:text-red-700">{product.name}</button>
                    <p className="mt-1 text-xs text-neutral-500">{product.model} · {product.sku}</p>
                    <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{product.specs}</p>
                    <div className="mt-auto pt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-black text-lg">{formatCustomerPrice(product.price)}</p>
                        <p className={`text-xs font-semibold ${available ? 'text-emerald-700' : 'text-red-700'}`}>{available ? `${product.stockQuantity} available` : 'Out of stock'}</p>
                      </div>
                      {quantityInCart > 0 ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => onUpdateCart(product, -1)} className="h-9 w-9 rounded-lg border border-neutral-300 flex items-center justify-center" aria-label={`Remove one ${product.name}`}><Minus size={16} /></button>
                          <span className="min-w-5 text-center font-bold">{quantityInCart}</span>
                          <button type="button" onClick={() => onUpdateCart(product, 1)} disabled={quantityInCart >= product.stockQuantity} className="h-9 w-9 rounded-lg border border-neutral-300 flex items-center justify-center disabled:opacity-40" aria-label={`Add one ${product.name}`}><Plus size={16} /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => onUpdateCart(product, 1)} disabled={!available} className="rounded-lg bg-red-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-red-800 disabled:bg-neutral-300 disabled:text-neutral-600">Add to cart</button>
                      )}
                    </div>
                    <button type="button" onClick={() => onOpenProduct(product)} className="mt-3 w-full border-t border-neutral-100 pt-3 text-left text-xs font-bold text-neutral-600 hover:text-red-700 inline-flex items-center gap-1.5">
                      <Eye size={14} /> Quick view <ChevronRight size={14} className="ml-auto" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {activeTab === 'catalog' && recentlyViewedProducts.length > 0 && (
        <section className="mt-10 border-t border-neutral-200 pt-6">
          <div className="flex items-end justify-between mb-3"><div><p className="text-[11px] font-bold uppercase text-neutral-500">Your activity</p><h2 className="text-lg font-extrabold">Recently viewed</h2></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentlyViewedProducts.map((product) => (
              <button key={product.id} type="button" onClick={() => onOpenProduct(product)} className="text-left bg-white border border-neutral-200 rounded-lg p-2.5 hover:border-neutral-400">
                <div className="h-24 overflow-hidden rounded-md bg-neutral-100"><ProductImage product={product} /></div>
                <span className="mt-2 block text-xs font-bold line-clamp-1">{product.name}</span>
                <span className="text-xs text-neutral-500">{formatCustomerPrice(product.price)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}