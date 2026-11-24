import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, LockKeyhole, LogIn, UserPlus } from 'lucide-react';
import { apiRequest, saveSession, ApiUser } from '../lib/api';

type Props = { mode: 'customer' | 'admin'; onBack: () => void; onSuccess: (user: ApiUser) => void };
type AuthView = 'signin' | 'register' | 'forgot' | 'reset';
type GoogleState = 'loading' | 'ready' | 'unavailable';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string; text: string; width: number },
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path fill="#4285F4" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 1 1 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7A19.9 19.9 0 0 0 24 4a20 20 0 1 0 20 20c0-1.3-.1-2.6-.4-3.9Z" />
    <path fill="#34A853" d="M6.3 14.7 12.9 19A12 12 0 0 1 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7A19.9 19.9 0 0 0 24 4C16.4 4 9.8 8.3 6.3 14.7Z" />
    <path fill="#FBBC05" d="M24 44c5.2 0 9.8-2 13.3-5.3l-6.2-5.2a11.9 11.9 0 0 1-17.8-6.2l-6.6 5.1A20 20 0 0 0 24 44Z" />
    <path fill="#EA4335" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.2 5.5l6.2 5.2C41.1 35 44 29.9 44 24c0-1.3-.1-2.6-.4-3.9Z" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Load the GIS script once and call `onReady` when window.google is available.
   Returns a cleanup that prevents the callback from firing after unmount.
───────────────────────────────────────────────────────────────────────────── */
function loadGIS(onReady: () => void, onError: () => void): () => void {
  if (window.google?.accounts?.id) { onReady(); return () => {}; }

  const existing = document.querySelector<HTMLScriptElement>(
    'script[src="https://accounts.google.com/gsi/client"]',
  );

  let cancelled = false;
  const safeReady = () => { if (!cancelled) onReady(); };
  const safeError = () => { if (!cancelled) onError(); };

  if (existing) {
    // Script already injected by a previous render — wait for it
    if (existing.dataset.loaded === 'true') { safeReady(); return () => { cancelled = true; }; }
    existing.addEventListener('load', safeReady, { once: true });
    existing.addEventListener('error', safeError, { once: true });
    return () => {
      cancelled = true;
      existing.removeEventListener('load', safeReady);
      existing.removeEventListener('error', safeError);
    };
  }

  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.addEventListener('load', () => { script.dataset.loaded = 'true'; safeReady(); }, { once: true });
  script.addEventListener('error', safeError, { once: true });
  document.head.appendChild(script);
  return () => {
    cancelled = true;
    script.removeEventListener('load', safeReady);
    script.removeEventListener('error', safeError);
  };
}

export default function CustomerAuth({ mode, onBack, onSuccess }: Props) {
  const resetParams = new URLSearchParams(window.location.search);
  const [view, setView] = useState<AuthView>(
    mode === 'customer' && resetParams.has('resetToken') ? 'reset' : 'signin',
  );
  const [resetToken] = useState(resetParams.get('resetToken') || '');
  const [email, setEmail] = useState(resetParams.get('email') || '');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleState, setGoogleState] = useState<GoogleState>('loading');
  const [googleClientId, setGoogleClientId] = useState('');

  /* Stable ref so the GIS callback always reaches the latest authenticateGoogle */
  const credentialCallbackRef = useRef<(credential: string) => void>(() => {});

  /*
   * Callback ref — fires immediately after the GIS container div is attached
   * to the DOM. This avoids the race condition where gisButtonRef.current is
   * null when the effect that calls renderButton runs.
   */
  const gisContainerRef = useRef<HTMLDivElement | null>(null);
  const gisReadyRef = useRef(false); // tracks whether GIS script has loaded

  /* ── Clean reset-token param from URL ── */
  useEffect(() => {
    if (view === 'reset')
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  }, [view]);

  /* ── Fetch Google Client ID from the backend config endpoint ── */
  useEffect(() => {
    if (mode !== 'customer') return;
    let active = true;

    const resolve = (id: string | null) => {
      if (!active) return;
      const finalId = id || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
      if (finalId) {
        setGoogleClientId(finalId);
        setGoogleState('ready');
      } else {
        setGoogleState('unavailable');
      }
    };

    apiRequest<{ clientId: string | null }>('/auth/google/config')
      .then(({ clientId }) => resolve(clientId))
      .catch(() => resolve(null));

    return () => { active = false; };
  }, [mode]);

  /* ── Google credential handler ── */
  const authenticateGoogle = useCallback(
    async (credential: string) => {
      setError('');
      setGoogleLoading(true);
      setBusy(true);
      try {
        const result = await apiRequest<{ token: string; user: ApiUser }>('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ credential }),
        });
        if (result.user.role !== 'customer') {
          throw new Error('This Google account is not a customer account. Use the administrator sign-in.');
        }
        saveSession(result.token, result.user);
        onSuccess(result.user);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Google sign-in failed. Please try again.');
        setBusy(false);
        setGoogleLoading(false);
      }
    },
    [onSuccess],
  );

  /* Keep stable ref in sync */
  useEffect(() => { credentialCallbackRef.current = authenticateGoogle; }, [authenticateGoogle]);

  /*
   * Core: render the GIS button.
   * Called both when the container div mounts (via callback ref) and when
   * the GIS script finishes loading — whichever comes last.
   */
  const tryRenderGIS = useCallback(() => {
    const el = gisContainerRef.current;
    if (!el || !gisReadyRef.current || !googleClientId) return;
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      cancel_on_tap_outside: true,
      callback: (response) => { void credentialCallbackRef.current(response.credential); },
    });
    window.google.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      width: Math.min(el.offsetWidth || 480, 640),
    });
  }, [googleClientId]);

  /*
   * When googleState becomes 'ready', load the GIS script.
   * Once loaded, mark gisReadyRef true and try to render.
   */
  useEffect(() => {
    if (googleState !== 'ready' || !googleClientId) return;

    const cancel = loadGIS(
      () => {
        gisReadyRef.current = true;
        tryRenderGIS();
      },
      () => setError('Google sign-in could not be loaded. Check your internet connection.'),
    );

    return cancel;
  }, [googleState, googleClientId, tryRenderGIS]);

  /*
   * Callback ref for the GIS container div.
   * React calls this after the element is painted — the element is guaranteed
   * to exist, eliminating the ref-is-null race condition.
   */
  const setGisContainer = useCallback(
    (el: HTMLDivElement | null) => {
      gisContainerRef.current = el;
      if (el) tryRenderGIS(); // element just mounted — try to render GIS into it
    },
    [tryRenderGIS],
  );

  /* Re-render GIS button if the view switches back to signin */
  useEffect(() => {
    if (view === 'signin' && googleState === 'ready') tryRenderGIS();
  }, [view, googleState, tryRenderGIS]);

  /* ── Form submit handler ── */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (view === 'forgot') {
        const result = await apiRequest<{ message: string }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setNotice(result.message);
        return;
      }
      if (view === 'reset') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const result = await apiRequest<{ message: string }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, password }),
        });
        setView('signin');
        setPassword('');
        setConfirmPassword('');
        setNotice(result.message);
        return;
      }
      const isRegister = view === 'register' && mode === 'customer';
      const result = await apiRequest<{ token: string; user: ApiUser }>(
        `/auth/${isRegister ? 'register' : 'login'}`,
        {
          method: 'POST',
          body: JSON.stringify(
            isRegister ? { fullName, email, phone, password } : { email, password },
          ),
        },
      );
      if (mode === 'admin' && result.user.role !== 'admin')
        throw new Error('This account does not have administrator access.');
      saveSession(result.token, result.user);
      onSuccess(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to authenticate.');
    } finally {
      setBusy(false);
    }
  };

  /* ── Derived UI text ── */
  const title =
    mode === 'admin' ? 'Administrator sign in'
    : view === 'register' ? 'Create account'
    : view === 'forgot'   ? 'Forgot password?'
    : view === 'reset'    ? 'Reset password'
    : 'Sign in';

  const description =
    mode === 'admin'    ? 'Authorized store administrators only.'
    : view === 'forgot' ? 'Enter your email and we will send you a password reset link.'
    : view === 'reset'  ? 'Choose a new password for your account.'
    : 'Sign in to place orders and manage your purchases.';

  const inputClass =
    'mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3.5 outline-none ' +
    'focus:border-red-700 focus:ring-2 focus:ring-red-100 ' +
    'disabled:bg-neutral-50 disabled:text-neutral-400';

  const showGoogleSection = mode === 'customer' && view === 'signin';

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-[740px] rounded-[26px] border border-neutral-200 bg-white p-6 shadow-xl sm:p-10 md:p-12">

        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-950 disabled:opacity-50"
        >
          <ArrowLeft size={18} /> Back to store
        </button>

        <div className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-red-50 text-red-700">
          <LockKeyhole size={32} />
        </div>

        <p className="mt-7 text-sm font-extrabold uppercase tracking-[0.12em] text-red-800">
          Hawassa-Ketema Computers
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-500">{description}</p>

        {/* ── Google section ── */}
        {showGoogleSection && (
          <div className="mt-7">

            {/* Skeleton while fetching config */}
            {googleState === 'loading' && (
              <div className="flex h-[52px] w-full animate-pulse items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-neutral-100 text-sm font-semibold text-neutral-400">
                <GoogleIcon />
                Continue with Google
              </div>
            )}

            {/* GIS button container — callback ref guarantees DOM node exists */}
            {googleState === 'ready' && (
              <div className="relative">
                <div
                  ref={setGisContainer}
                  className={`flex min-h-[52px] w-full items-center justify-center overflow-hidden rounded-xl transition-opacity duration-150 ${
                    googleLoading || busy ? 'pointer-events-none opacity-40' : ''
                  }`}
                  aria-label="Continue with Google"
                />
                {googleLoading && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold text-neutral-500">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in with Google…
                  </div>
                )}
              </div>
            )}

            {/* Unavailable — clickable with explanation */}
            {googleState === 'unavailable' && (
              <button
                type="button"
                onClick={() =>
                  setError(
                    'Google sign-in is not configured on this server. Please sign in with your email and password.',
                  )
                }
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white py-3.5 text-base font-semibold text-neutral-500 shadow-sm transition hover:bg-neutral-50 hover:border-neutral-300"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            )}

            <div className="my-6 flex items-center gap-4 text-sm text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              <span>or sign in with email</span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
          </div>
        )}

        {/* ── Email / password form ── */}
        <form onSubmit={submit} className={`space-y-5 ${showGoogleSection ? '' : 'mt-7'}`}>
          {view === 'register' && mode === 'customer' && (
            <label className="block text-base font-semibold">
              Full name
              <input required minLength={2} autoComplete="name" disabled={busy}
                value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
            </label>
          )}

          {view !== 'reset' && (
            <label className="block text-base font-semibold">
              Email
              <input required type="email" autoComplete="email" disabled={busy}
                value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </label>
          )}

          {view === 'register' && mode === 'customer' && (
            <label className="block text-base font-semibold">
              Phone number
              <input type="tel" autoComplete="tel" disabled={busy}
                value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </label>
          )}

          {(view === 'signin' || view === 'register' || view === 'reset') && (
            <div className="block text-base font-semibold">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="auth-password">
                  {view === 'reset' ? 'New password' : 'Password'}
                </label>
                {view === 'signin' && mode === 'customer' && (
                  <button type="button"
                    onClick={() => { setView('forgot'); setError(''); setNotice(''); }}
                    className="text-sm font-semibold text-blue-800 hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <input id="auth-password" required type="password"
                minLength={view === 'signin' ? 1 : 8}
                autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                disabled={busy} value={password}
                onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
          )}

          {view === 'reset' && (
            <label className="block text-base font-semibold">
              Confirm new password
              <input required type="password" minLength={8} autoComplete="new-password"
                disabled={busy} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {notice}
            </p>
          )}

          <button type="submit" disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 py-4 text-lg font-bold text-white transition hover:bg-red-800 disabled:opacity-60">
            {busy && !googleLoading ? 'Please wait…'
              : view === 'register' ? 'Create account'
              : view === 'forgot'   ? 'Send reset link'
              : view === 'reset'    ? 'Reset password'
              : 'Sign in'}
            {!busy && view === 'register' && <UserPlus size={19} />}
            {!busy && view === 'signin'   && <LogIn size={19} />}
          </button>
        </form>

        {/* ── Footer links ── */}
        {mode === 'customer' && view === 'signin' && (
          <p className="mt-6 text-center text-base text-neutral-700">
            Don&apos;t have an account?{' '}
            <button type="button"
              onClick={() => { setView('register'); setError(''); setNotice(''); }}
              className="font-bold text-red-800 hover:underline">
              Create account
            </button>
          </p>
        )}

        {mode === 'customer' && (view === 'forgot' || view === 'reset') && (
          <button type="button"
            onClick={() => { setView('signin'); setError(''); setNotice(''); }}
            className="mt-5 w-full text-center text-sm font-semibold text-red-800 hover:underline">
            Back to sign in
          </button>
        )}

        {mode === 'customer' && view === 'register' && (
          <p className="mt-6 text-center text-base text-neutral-700">
            Already have an account?{' '}
            <button type="button"
              onClick={() => { setView('signin'); setError(''); setNotice(''); }}
              className="font-bold text-red-800 hover:underline">
              Sign in
            </button>
          </p>
        )}

      </div>
    </div>
  );
}
