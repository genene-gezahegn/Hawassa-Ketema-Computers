import {
  Mail,
  MapPin,
  Phone,
  Send,
  ShoppingBag,
  Heart,
  Home,
  PackageCheck,
  Monitor,
} from 'lucide-react';

interface Props {
  /** Pass tab-setter so nav links work inside the authenticated storefront.
   *  When omitted (landing page), links call onSelectTab if provided. */
  onNavigate?: (tab: 'catalog' | 'wishlist' | 'orders' | 'cart' | 'home') => void;
}

const CURRENT_YEAR = 2026;

export default function CustomerFooter({ onNavigate }: Props) {
  const nav = (tab: 'catalog' | 'wishlist' | 'orders' | 'cart' | 'home') => {
    if (onNavigate) {
      onNavigate(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="border-t border-neutral-800 bg-neutral-950 text-neutral-300" aria-label="Site footer">

      {/* ── Main grid ── */}
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">

          {/* ── A. Brand ── */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-700 font-black text-white text-base shadow-lg">
                HK
              </span>
              <div>
                <p className="text-sm font-extrabold leading-tight text-white">Hawassa-Ketema</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Computers</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-neutral-400">
              Your trusted destination for computers, laptops, accessories, and reliable technology solutions in Hawassa.
            </p>

            {/* Telegram */}
            <div className="mt-6">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Follow us</p>
              <a
                href="https://t.me/+STQvCr3k3RhmMDI8"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join our Telegram channel"
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3.5 py-2.5 text-xs font-semibold text-neutral-300 transition hover:border-sky-600 hover:bg-sky-900/30 hover:text-sky-300"
              >
                {/* Telegram SVG icon */}
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
                </svg>
                Telegram
              </a>
            </div>
          </div>

          {/* ── B. Quick navigation ── */}
          <div>
            <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Quick links</p>
            <ul className="space-y-3" role="list">
              <li>
                <button
                  type="button"
                  onClick={() => nav('catalog')}
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <Home size={13} className="shrink-0 text-red-500" /> Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => nav('catalog')}
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <Monitor size={13} className="shrink-0 text-red-500" /> Products / Shop
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => nav('wishlist')}
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <Heart size={13} className="shrink-0 text-red-500" /> Saved products
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => nav('orders')}
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <PackageCheck size={13} className="shrink-0 text-red-500" /> My orders
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => nav('cart')}
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <ShoppingBag size={13} className="shrink-0 text-red-500" /> Cart
                </button>
              </li>
            </ul>
          </div>

          {/* ── C. Contact ── */}
          <div>
            <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Contact us</p>
            <ul className="space-y-4" role="list">
              <li>
                <a
                  href="mailto:genenedev@gmail.com"
                  className="group inline-flex items-start gap-2.5 text-sm text-neutral-400 transition hover:text-white"
                  aria-label="Send email to genenedev@gmail.com"
                >
                  <Mail size={14} className="mt-0.5 shrink-0 text-red-500 transition group-hover:text-red-400" />
                  <span>genenedev@gmail.com</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:+251930407122"
                  className="group inline-flex items-start gap-2.5 text-sm text-neutral-400 transition hover:text-white"
                  aria-label="Call +251 930 407 122"
                >
                  <Phone size={14} className="mt-0.5 shrink-0 text-red-500 transition group-hover:text-red-400" />
                  <span>+251 930 407 122</span>
                </a>
              </li>
              <li>
                <span className="inline-flex items-start gap-2.5 text-sm text-neutral-400">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-red-500" />
                  <span>Hawassa, Sidama, Ethiopia</span>
                </span>
              </li>
            </ul>
          </div>

          {/* ── D. Customer support ── */}
          <div>
            <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Customer support</p>
            <ul className="space-y-3" role="list">
              <li>
                <a
                  href="mailto:genenedev@gmail.com"
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                  aria-label="Contact support via email"
                >
                  <Send size={13} className="shrink-0 text-red-500" /> Contact support
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => nav('orders')}
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <PackageCheck size={13} className="shrink-0 text-red-500" /> Order information
                </button>
              </li>
            </ul>

            {/* Business hours */}
            <div className="mt-8">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Business hours</p>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Mon – Sat: 8:00 AM – 7:00 PM<br />
                Sunday: 10:00 AM – 5:00 PM
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-neutral-800">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-neutral-500 sm:flex-row sm:px-6">
          <p>© {CURRENT_YEAR} Hawassa-Ketema Computers. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with
            <span className="mx-0.5 text-red-600" aria-hidden="true">♥</span>
            in Hawassa, Ethiopia
          </p>
        </div>
      </div>

    </footer>
  );
}
