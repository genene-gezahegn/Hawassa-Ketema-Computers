import React from 'react';
import { Check, Heart, X } from 'lucide-react';
import { Product } from '../lib/inventory';
import ProductImage from './ProductImage';
import { formatCustomerPrice } from './customerStorefrontTypes';

interface CustomerProductDialogsProps {
  selectedProduct: Product | null;
  compareOpen: boolean;
  compareProducts: Product[];
  wishlist: string[];
  onCloseProduct: () => void;
  onToggleWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  onCloseComparison: () => void;
  onRemoveComparison: (productId: string) => void;
}

export default function CustomerProductDialogs({
  selectedProduct,
  compareOpen,
  compareProducts,
  wishlist,
  onCloseProduct,
  onToggleWishlist,
  onAddToCart,
  onCloseComparison,
  onRemoveComparison,
}: CustomerProductDialogsProps) {
  return (
    <>
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 p-3 sm:p-6 flex items-center justify-center"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseProduct(); }}
          onKeyDown={(event) => { if (event.key === 'Escape') onCloseProduct(); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="quick-view-title" className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <button type="button" onClick={onCloseProduct} className="absolute right-3 top-3 z-10 h-10 w-10 rounded-full bg-white/95 flex items-center justify-center text-neutral-800 shadow" aria-label="Close product details"><X size={19} /></button>
            <div className="grid md:grid-cols-2">
              <div className="min-h-64 md:min-h-[440px] bg-neutral-100"><ProductImage product={selectedProduct} /></div>
              <div className="p-5 sm:p-8 flex flex-col">
                <p className="text-xs font-bold uppercase text-red-700">{selectedProduct.category} · {selectedProduct.brand}</p>
                <h2 id="quick-view-title" className="mt-2 text-2xl font-black leading-tight">{selectedProduct.name}</h2>
                <p className="mt-2 text-sm text-neutral-600">{selectedProduct.model} · {selectedProduct.sku}</p>
                <p className="mt-5 text-2xl font-black">{formatCustomerPrice(selectedProduct.price)}</p>
                <p className={`mt-1 text-sm font-bold ${selectedProduct.stockQuantity > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {selectedProduct.stockQuantity > 0 ? `${selectedProduct.stockQuantity} units available` : 'Currently out of stock'}
                </p>
                <div className="mt-5 border-y border-neutral-200 py-4">
                  <p className="text-xs font-bold uppercase text-neutral-500">Specifications</p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">{selectedProduct.specs}</p>
                  <p className="mt-3 text-xs text-neutral-500">Condition: <span className="font-semibold text-neutral-700">{selectedProduct.condition}</span></p>
                </div>
                <div className="mt-auto pt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onToggleWishlist(selectedProduct.id)} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-3 text-sm font-bold hover:bg-neutral-50">
                    <Heart size={17} fill={wishlist.includes(selectedProduct.id) ? 'currentColor' : 'none'} />
                    {wishlist.includes(selectedProduct.id) ? 'Saved' : 'Save item'}
                  </button>
                  <button type="button" disabled={selectedProduct.stockQuantity <= 0} onClick={() => onAddToCart(selectedProduct)} className="flex-1 rounded-lg bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:bg-neutral-300">
                    Add to cart
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {compareOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 p-3 sm:p-6 flex items-center justify-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseComparison(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="compare-title" className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase text-red-700">Side-by-side</p><h2 id="compare-title" className="text-xl font-black">Compare products</h2></div>
              <button type="button" onClick={onCloseComparison} className="h-10 w-10 rounded-full hover:bg-neutral-100 flex items-center justify-center" aria-label="Close comparison"><X size={19} /></button>
            </header>
            {compareProducts.length < 2 ? (
              <p className="p-8 text-center text-sm text-neutral-600">Select at least two products to compare.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200">
                {compareProducts.map((product) => (
                  <article key={product.id} className="p-4 sm:p-5">
                    <div className="h-36 rounded-lg overflow-hidden bg-neutral-100"><ProductImage product={product} /></div>
                    <p className="mt-3 text-[11px] font-bold uppercase text-neutral-500">{product.category} · {product.brand}</p>
                    <h3 className="mt-1 font-extrabold leading-snug">{product.name}</h3>
                    <p className="mt-2 text-xl font-black">{formatCustomerPrice(product.price)}</p>
                    <dl className="mt-4 divide-y divide-neutral-100 text-sm">
                      <div className="py-2"><dt className="text-xs text-neutral-500">Model</dt><dd className="font-semibold">{product.model}</dd></div>
                      <div className="py-2"><dt className="text-xs text-neutral-500">Availability</dt><dd className="font-semibold">{product.stockQuantity > 0 ? `${product.stockQuantity} units` : 'Out of stock'}</dd></div>
                      <div className="py-2"><dt className="text-xs text-neutral-500">Condition</dt><dd className="font-semibold">{product.condition}</dd></div>
                      <div className="py-2"><dt className="text-xs text-neutral-500">Specifications</dt><dd className="text-xs leading-relaxed">{product.specs}</dd></div>
                    </dl>
                    <button type="button" onClick={() => onRemoveComparison(product.id)} className="mt-3 text-xs font-bold text-neutral-500 hover:text-red-700">Remove from comparison</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}