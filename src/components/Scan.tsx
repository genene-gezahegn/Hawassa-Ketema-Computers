import React, { useState, useEffect, useRef } from 'react';
import { useInventoryStore } from '../store/inventoryStore';
import { Product, getStockStatus } from '../lib/inventory';

export default function Scan() {
  const { products, viewProductDetails, setActiveView } = useInventoryStore();

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [scannedCode, setScannedCode] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [searched, setSearched] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(false);
  };

  // Resolve code against inventory database
  const handleCodeFound = (code: string) => {
    stopCamera();
    setScannedCode(code);
    setManualInput(code);
    setSearched(true);

    const clean = code.trim().toLowerCase();

    // 1. Direct SKU or Product Code match
    let found = products.find(
      (p) =>
        p.sku.toLowerCase() === clean ||
        (p.productCode && p.productCode.toLowerCase() === clean)
    );

    // 2. Hardware Serial Number match
    if (!found) {
      found = products.find(
        (p) =>
          (p.serialNumber && p.serialNumber.toLowerCase() === clean) ||
          (p.serialNumbers &&
            p.serialNumbers.some((s) => s.serialNumber.toLowerCase() === clean))
      );
    }

    // 3. Name or Model substring match
    if (!found) {
      found = products.find(
        (p) =>
          p.name.toLowerCase() === clean ||
          p.model.toLowerCase() === clean
      );
    }

    setMatchedProduct(found || null);
  };

  useEffect(() => {
    if (!isScanning) return;

    const video = videoRef.current;
    if (!video) {
      setCameraError('Unable to start the camera viewfinder. Please try again or enter the code manually.');
      setIsScanning(false);
      return;
    }

    let cancelled = false;
    const startDecoder = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result) handleCodeFound(result.getText());
        });

        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (error: unknown) {
        if (cancelled) return;

        const errorName = error instanceof Error ? error.name : '';
        setCameraError(
          errorName === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access in your browser, or enter the code manually below.'
            : errorName === 'NotFoundError'
              ? 'No camera was found on this device. Enter the code manually below.'
              : 'Unable to access the camera. Use localhost or HTTPS, allow camera access, or enter the code manually below.'
        );
        setIsScanning(false);
      }
    };

    void startDecoder();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isScanning]);

  const startCamera = () => {
    setCameraError('');
    setSearched(false);
    setMatchedProduct(null);
    setIsScanning(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleCodeFound(manualInput.trim());
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
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
            <span className="text-red-700">Barcode & QR Scanner</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Barcode & QR Scanner</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                isScanning
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
              }`}
            >
              {isScanning ? '📷 Camera Active' : '📷 Camera Ready'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Scan physical hardware labels, QR tags, or serial stickers to immediately look up products.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-all shadow-sm active:scale-95 min-h-[44px] self-start sm:self-auto"
        >
          ← Dashboard
        </button>
      </div>

      {/* Main Scanner Container */}
      <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-6">
        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">
                  Live Camera Scanner
                </h3>
                <p className="text-xs text-neutral-500">
                  Scan QR codes and common retail barcodes with your device camera.
                </p>
              </div>

              {!isScanning ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-xs shadow hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
                >
                  <span>📷</span> Open Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs shadow active:scale-95 transition-all min-h-[44px]"
                >
                  ⏹ Stop Camera
                </button>
              )}
            </div>

            {/* Video Viewfinder Box */}
            {isScanning && (
              <div className="relative w-full max-w-lg mx-auto aspect-video rounded-2xl overflow-hidden bg-black border-4 border-neutral-900 shadow-2xl">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Hawassa-Ketema Red Targeting Reticle & Scanning Beam */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                  <div className="w-64 h-48 border-2 border-red-500 rounded-2xl relative shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />

                    {/* Animated Red Laser Scan Beam */}
                    <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="absolute bottom-3 inset-x-0 text-center">
                  <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-sm text-white text-[11px] font-bold">
                    Scanning for QR, Code 128, EAN, UPC...
                  </span>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold">
                ⚠️ {cameraError}
              </div>
            )}
        </div>

        {/* Manual Barcode & SKU Fallback Form */}
        <div className="pt-4 border-t border-neutral-100 space-y-3">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
            Or Enter Barcode / SKU / Serial Number Manually:
          </label>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. HK-LAP-HP-1011 or 5CD34199KL-01"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-300 font-mono text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[48px]"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs shadow active:scale-95 transition-all min-h-[48px]"
            >
              Look Up
            </button>
          </form>

          {/* Quick-test sample chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
            <span className="text-neutral-400 font-bold text-[11px]">Quick Samples:</span>
            {['HK-LAP-HP-1011', 'HK-LAP-APP-1014', '5CD34199KL-01', 'HK-PWR-APC-3011'].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setManualInput(sample);
                  handleCodeFound(sample);
                }}
                className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold border border-neutral-200 transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SCAN RESULT DISPLAY */}
        {/* ================================================================ */}
        {searched && (
          <div className="pt-4 border-t-2 border-neutral-100 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Lookup Result for: <strong className="font-mono text-neutral-900">{scannedCode}</strong>
              </span>
              {matchedProduct ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
                  ✓ Matched Product
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-black text-xs">
                  ✕ No Match Found
                </span>
              )}
            </div>

            {matchedProduct ? (
              <div className="p-5 bg-neutral-50 rounded-2xl border-2 border-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase text-red-700">
                      {matchedProduct.brand} &bull; {matchedProduct.category}
                    </span>
                    <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-neutral-200 font-bold">
                      SKU: {matchedProduct.sku}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-neutral-900">
                    {matchedProduct.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Model: {matchedProduct.model} &bull; Condition: {matchedProduct.condition}
                  </p>

                  <div className="flex items-center gap-3 mt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold block uppercase">On Hand</span>
                      <span className="text-lg font-black text-neutral-900">
                        {matchedProduct.stockQuantity} units
                      </span>
                    </div>

                    <div className="border-l border-neutral-200 pl-3">
                      <span className="text-[10px] text-neutral-400 font-bold block uppercase">Selling Price</span>
                      <span className="text-lg font-black text-red-700">
                        ETB {matchedProduct.price.toLocaleString()}
                      </span>
                    </div>

                    <div className="border-l border-neutral-200 pl-3">
                      <span className="text-[10px] text-neutral-400 font-bold block uppercase">Status</span>
                      <span className="font-bold text-neutral-800">
                        {getStockStatus(matchedProduct).replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => viewProductDetails(matchedProduct.id)}
                    className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-extrabold shadow active:scale-95 transition-all text-center min-h-[44px]"
                  >
                    View Product Details →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      useInventoryStore.setState({ selectedProductId: matchedProduct.id });
                      setActiveView('stock_out');
                    }}
                    disabled={matchedProduct.stockQuantity <= 0}
                    className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl text-xs font-extrabold shadow active:scale-95 transition-all text-center min-h-[44px]"
                  >
                    Stock Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
                <span className="text-3xl">🔍</span>
                <h4 className="font-extrabold text-neutral-900 text-sm">
                  No Inventory Item Found with Code "{scannedCode}"
                </h4>
                <p className="text-xs text-neutral-600 max-w-sm mx-auto">
                  This barcode or serial number is not yet registered in Hawassa-Ketema Computers.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('add_item')}
                  className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow min-h-[40px]"
                >
                  + Register New Product with this SKU
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
