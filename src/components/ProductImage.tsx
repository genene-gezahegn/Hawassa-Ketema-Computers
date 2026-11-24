import React, { useState } from 'react';
import { BatteryCharging, Cable, Laptop, Monitor, Sun } from 'lucide-react';
import { Product } from '../lib/inventory';

interface ProductImageProps {
  product: Product;
}

export default function ProductImage({ product }: ProductImageProps) {
  const [failedPhoto, setFailedPhoto] = useState('');

  if (product.productPhoto && product.productPhoto !== failedPhoto) {
    return (
      <img
        src={product.productPhoto}
        alt={product.name}
        onError={() => setFailedPhoto(product.productPhoto || '')}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    );
  }

  const Icon =
    product.category === 'Laptop'
      ? Laptop
      : product.category === 'Desktop'
        ? Monitor
        : product.category === 'Power Solutions'
          ? product.subcategory?.toLowerCase().includes('battery')
            ? BatteryCharging
            : Sun
          : Cable;

  return (
    <div
      role="img"
      aria-label={`${product.name} image unavailable`}
      className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-500"
    >
      <Icon aria-hidden="true" className="h-12 w-12 stroke-[1.4]" />
      <span className="text-xs font-semibold">{product.category}</span>
    </div>
  );
}