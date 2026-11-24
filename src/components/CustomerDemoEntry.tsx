import React, { useState } from 'react';
import {
  ChevronRight,
  Heart,
  Home,
  LayoutGrid,
  Search,
  ShoppingCart,
  Store,
  UserRound,
} from 'lucide-react';
import { Category, Product } from '../lib/inventory';
import ProductImage from './ProductImage';
import { CustomerTab, customerCategories, formatCustomerPrice } from './customerStorefrontTypes';
import CustomerFooter from './CustomerFooter';

interface CustomerDemoEntryProps {
  featuredProduct: Product;
  products: Product[];
  productCount: number;
  cartCount: number;
  savedCount: number;
  onEnterDemo: () => void;
  onSelectTab: (tab: CustomerTab) => void;
  onSelectCategory: (category: Category | 'All') => void;
  onOpenProduct: (product: Product) => void;
  onSearch: (query: string) => void;
  onAccount: () => void;
}

export default function CustomerDemoEntry({
  featuredProduct,
  products,
  productCount,
  cartCount,
  savedCount,
  onEnterDemo,
  onSelectTab,
  onSelectCategory,
  onOpenProduct,
  onSearch,
  onAccount,
}: CustomerDemoEntryProps) {
  const [query, setQuery] = useState('');
  const previewProducts = products.slice(0, 3);
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    onSearch(query);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950 text-white">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex min-w-0 items-center gap-3 text-left" aria-label="Hawassa-Ketema home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-700 font-black text-white">HK</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight sm:text-base">Hawassa-Ketema</p>
              <p className="hidden text-[9px] uppercase tracking-[0.16em] text-neutral-400 sm:block">Computers · Hawassa</p>
            </div>
          </button>

          <nav className="flex shrink-0 items-center gap-1" aria-label="Storefront navigation">
            <button type="button" aria-label="Home" aria-current="page" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-1.5 border-b-2 border-red-600 px-2 py-2 text-xs font-bold text-white sm:px-3 sm:text-sm">
              <Home size={16} /><span className="hidden sm:inline">Home</span>
            </button>
            <button type="button" aria-label="Catalog" onClick={() => onSelectTab('catalog')} className="inline-flex items-center gap-1.5 rounded px-2 py-2 text-xs font-bold text-neutral-300 transition hover:text-white sm:px-3 sm:text-sm">
              <LayoutGrid size={16} /><span className="hidden sm:inline">Catalog</span>
            </button>
            <button type="button" aria-label="Saved products" onClick={() => onSelectTab('wishlist')} className="inline-flex items-center gap-1.5 rounded px-2 py-2 text-xs font-bold text-neutral-300 transition hover:text-white sm:px-3 sm:text-sm">
              <Heart size={16} /><span className="hidden sm:inline">Saved</span>
            </button>
            <button type="button" aria-label={`Cart, ${cartCount} items`} onClick={() => onSelectTab('cart')} className="inline-flex items-center gap-1.5 rounded px-2 py-2 text-xs font-bold text-neutral-300 transition hover:text-white sm:px-3 sm:text-sm">
              <ShoppingCart size={16} /><span className="hidden sm:inline">Cart</span><span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[10px]">{cartCount}</span>
            </button>
          </nav>

          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <form onSubmit={submitSearch} role="search" className="hidden min-w-0 sm:block">
              <label className="flex h-9 w-40 items-center gap-2 rounded-full bg-white/10 px-3 text-neutral-300 focus-within:ring-2 focus-within:ring-red-500 md:w-48 lg:w-56">
                <Search size={15} className="shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-neutral-400"
                />
              </label>
            </form>
            <button type="button" onClick={onAccount} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-neutral-200 transition hover:text-white sm:text-sm" aria-label="Sign in">
              <UserRound size={16} /><span className="hidden md:inline">Sign in</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-68px)] max-w-[1440px] grid-cols-1 lg:grid-cols-[minmax(0,1.42fr)_minmax(420px,1fr)]">
        <section className="relative isolate min-h-[440px] overflow-hidden bg-neutral-950 text-white sm:min-h-[520px] lg:min-h-[calc(100vh-68px)]">
          <div className="absolute inset-0"><ProductImage product={featuredProduct} /></div>
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/85 via-neutral-950/55 to-neutral-900/20" />
          <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:64px_64px]" />
          <div className="relative z-10 flex min-h-[440px] flex-col justify-between p-6 sm:min-h-[520px] sm:p-10 lg:min-h-[calc(100vh-68px)] lg:p-12 xl:p-14">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-black/25 px-3.5 py-2 text-xs font-semibold text-white/90 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Hawassa · Sidama · Ethiopia
            </div>
            <div className="max-w-3xl py-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80 sm:text-sm">Hawassa-Ketema Computers</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-[2.5rem] xl:text-6xl">Technology for work, home, and beyond.</h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">Discover computers, accessories, and power solutions from a local Hawassa catalog.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={onEnterDemo} aria-label="Enter storefront demo" className="inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-600 sm:text-sm">
                  Browse Catalog <ChevronRight size={16} />
                </button>
                <button type="button" onClick={() => onSelectTab('catalog')} className="rounded-full border border-white/35 bg-black/20 px-5 py-3 text-xs font-bold text-white transition hover:bg-white/15 sm:text-sm">Our Products</button>
                <button type="button" onClick={() => onSelectTab('catalog')} className="rounded-full border border-white/35 bg-black/20 px-5 py-3 text-xs font-bold text-white transition hover:bg-white/15 sm:text-sm">Best Deals</button>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-white/85">
                <Store size={16} className="text-emerald-400" />
                <span>Trusted Local Store</span><span className="text-white/50">|</span>
                <span>Quality Products</span><span className="text-white/50">|</span>
                <span>Great Support</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-white/80">
                <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5">{productCount} catalog products</span>
                <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5">Prices in ETB</span>
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 bg-white p-3 sm:p-5 lg:flex lg:items-center lg:p-3 xl:p-5">
          <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex h-14 items-center justify-between border-b border-neutral-100 px-3 sm:px-4">
              <div className="flex items-center gap-2">
                <span className="font-black text-red-700">HK</span>
                <div>
                  <p className="text-[11px] font-extrabold leading-tight">Hawassa-Ketema</p>
                  <p className="text-[7px] uppercase tracking-wider text-neutral-500">Computers · Hawassa</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-2.5 py-1.5 text-white"><Store size={11} /> Catalog</span>
                <button type="button" onClick={() => onSelectTab('wishlist')} className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-neutral-600 hover:bg-neutral-100"><Heart size={11} /> Saved{savedCount > 0 && ` ${savedCount}`}</button>
                <button type="button" onClick={() => onSelectTab('orders')} className="hidden items-center gap-1 rounded-full px-2 py-1.5 text-neutral-600 hover:bg-neutral-100 sm:inline-flex"><Store size={11} /> Orders</button>
                <button type="button" onClick={() => onSelectTab('cart')} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1.5 text-red-700"><ShoppingCart size={11} /> Cart {cartCount}</button>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <p className="text-[9px] font-bold uppercase text-red-700">Curated local inventory</p>
              <div className="mt-1 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black leading-tight sm:text-2xl">Find your next upgrade</h2>
                  <p className="mt-1 text-[10px] text-neutral-600">Browse the store as a guest</p>
                </div>
                <form onSubmit={submitSearch} className="shrink-0">
                  <label className="flex h-8 w-28 items-center gap-1.5 rounded-lg border border-neutral-200 px-2 text-neutral-400 sm:w-32">
                    <Search size={12} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." aria-label="Search catalog preview" className="w-full bg-transparent text-[9px] text-neutral-800 outline-none placeholder:text-neutral-400" />
                  </label>
                </form>
              </div>

              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {customerCategories.map((category) => {
                  const count = category === 'All' ? products.length : products.filter((product) => product.category === category).length;
                  return (
                    <button key={category} type="button" onClick={() => onSelectCategory(category)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-semibold ${category === 'All' ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-700'}`}>
                      {category} <span className="opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 text-[9px] text-neutral-500">
                <span>Showing {productCount} products</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-md border border-neutral-200 px-2 py-1">□ In stock</span>
                  <span className="rounded-md border border-neutral-200 px-2 py-1">↕ Featured</span>
                  <span className="hidden rounded-md border border-neutral-200 px-2 py-1 sm:inline">Compare</span>
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {previewProducts.map((product) => (
                  <button key={product.id} type="button" onClick={() => onOpenProduct(product)} className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white text-left transition hover:border-neutral-400 hover:shadow-sm">
                    <div className="relative h-24 bg-neutral-100 sm:h-28">
                      <ProductImage product={product} />
                      <span className={`absolute left-1 top-1 rounded bg-white/95 px-1.5 py-0.5 text-[8px] font-bold ${product.stockQuantity > 0 ? 'text-emerald-700' : 'text-neutral-600'}`}>
                        {product.stockQuantity > 0 ? 'In stock' : 'Out of stock'}
                      </span>
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-neutral-700"><Heart size={11} /></span>
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[8px] font-bold uppercase text-neutral-500">{product.category} · {product.brand}</p>
                      <p className="mt-0.5 truncate text-[10px] font-extrabold">{product.name}</p>
                      <p className="mt-1 truncate text-[9px] font-bold text-neutral-800">{formatCustomerPrice(product.price)}</p>
                    </div>
                  </button>
                ))}
                {previewProducts.length === 0 && (
                  <div className="col-span-3 rounded-lg bg-neutral-50 px-3 py-8 text-center text-xs text-neutral-500">Products will appear here when the catalog is available.</div>
                )}
              </div>
              <button type="button" onClick={() => onSelectTab('catalog')} className="mt-3 w-full rounded-lg bg-red-700 py-2.5 text-xs font-bold text-white transition hover:bg-red-800">
                Browse all {productCount} products <ChevronRight size={14} className="ml-1 inline" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <CustomerFooter onNavigate={onSelectTab} />
    </div>
  );
}
