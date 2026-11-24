import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  LogIn,
  LogOut,
  Settings,
  User,
  X,
} from 'lucide-react';
import { ApiUser, saveSession, updateProfile } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  authenticated: boolean;
  customerName: string;
  customerPhone: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onProfileUpdated: (user: ApiUser) => void;
}

export default function CustomerSettingsPanel({
  open,
  onClose,
  authenticated,
  customerName,
  customerPhone,
  onSignIn,
  onSignOut,
  onProfileUpdated,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Which accordion section is open */
  const [section, setSection] = useState<'profile' | 'password' | null>('profile');

  /* Profile fields */
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  /* Password fields */
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /* Feedback */
  const [busy, setBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  /* Sync fields when panel opens */
  useEffect(() => {
    if (open) {
      setName(customerName);
      setPhone(customerPhone);
      setSection('profile');
      setProfileMsg(null);
      setPasswordMsg(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, customerName, customerPhone]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setBusy(true);
    try {
      const result = await updateProfile({ fullName: name.trim(), phone: phone.trim() || null });
      const token = localStorage.getItem('hk_access_token')!;
      saveSession(token, result.user);
      onProfileUpdated(result.user);
      setProfileMsg({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ type: 'err', text: err instanceof Error ? err.message : 'Unable to update profile.' });
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSave = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'New password and confirm password do not match.' });
      return;
    }
    setBusy(true);
    try {
      const result = await updateProfile({ currentPassword: oldPassword, newPassword, confirmPassword });
      const token = localStorage.getItem('hk_access_token')!;
      saveSession(token, result.user);
      onProfileUpdated(result.user);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setPasswordMsg({ type: 'ok', text: 'Password changed successfully.' });
    } catch (err) {
      setPasswordMsg({ type: 'err', text: err instanceof Error ? err.message : 'Unable to change password.' });
    } finally {
      setBusy(false);
    }
  };

  const input =
    'mt-1.5 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/25 transition';
  const lbl = 'block text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5';

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Slide-in drawer */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={`fixed left-0 top-0 z-50 flex h-full w-[300px] flex-col bg-neutral-900 shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-2 text-white">
            <Settings size={17} className="text-red-400" />
            <span className="text-sm font-extrabold tracking-tight">Settings</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

          {/* User info chip */}
          {authenticated && (
            <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-800/50 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-700 text-sm font-black text-white">
                {customerName.charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{customerName || '—'}</p>
                {customerPhone && <p className="truncate text-xs text-neutral-400">{customerPhone}</p>}
              </div>
            </div>
          )}

          {authenticated ? (
            <>
              {/* ── Profile accordion ── */}
              <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSection(section === 'profile' ? null : 'profile')}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-neutral-800/60"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <User size={15} className="text-red-400" /> Update Profile
                  </span>
                  {section === 'profile'
                    ? <ChevronDown size={15} className="text-neutral-400" />
                    : <ChevronRight size={15} className="text-neutral-400" />}
                </button>

                {section === 'profile' && (
                  <form
                    onSubmit={handleProfileSave}
                    className="border-t border-neutral-800 bg-neutral-800/30 px-4 pb-4 pt-4 space-y-4"
                  >
                    <div>
                      <label className={lbl}>Full name</label>
                      <input
                        required
                        minLength={2}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        placeholder="Your full name"
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Phone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="tel"
                        placeholder="+251 9XX XXX XXX"
                        className={input}
                      />
                    </div>

                    {profileMsg && (
                      <p
                        role={profileMsg.type === 'err' ? 'alert' : 'status'}
                        className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${
                          profileMsg.type === 'ok'
                            ? 'border border-emerald-800 bg-emerald-900/40 text-emerald-300'
                            : 'border border-red-800 bg-red-900/40 text-red-300'
                        }`}
                      >
                        {profileMsg.text}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Save changes'}
                    </button>
                  </form>
                )}
              </div>

              {/* ── Password accordion ── */}
              <div className="rounded-2xl border border-neutral-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSection(section === 'password' ? null : 'password')}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-neutral-800/60"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <Lock size={15} className="text-red-400" /> Change Password
                  </span>
                  {section === 'password'
                    ? <ChevronDown size={15} className="text-neutral-400" />
                    : <ChevronRight size={15} className="text-neutral-400" />}
                </button>

                {section === 'password' && (
                  <form
                    onSubmit={handlePasswordSave}
                    className="border-t border-neutral-800 bg-neutral-800/30 px-4 pb-4 pt-4 space-y-4"
                  >
                    <div>
                      <label className={lbl}>Old password</label>
                      <input
                        required
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={lbl}>New password</label>
                      <input
                        required
                        type="password"
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Confirm new password</label>
                      <input
                        required
                        type="password"
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Repeat new password"
                        className={input}
                      />
                    </div>

                    {passwordMsg && (
                      <p
                        role={passwordMsg.type === 'err' ? 'alert' : 'status'}
                        className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${
                          passwordMsg.type === 'ok'
                            ? 'border border-emerald-800 bg-emerald-900/40 text-emerald-300'
                            : 'border border-red-800 bg-red-900/40 text-red-300'
                        }`}
                      >
                        {passwordMsg.text}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Change password'}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            /* Not signed in — info nudge */
            <div className="rounded-2xl border border-neutral-800 bg-neutral-800/40 px-5 py-6 text-center">
              <User size={28} className="mx-auto mb-3 text-neutral-500" />
              <p className="text-sm text-neutral-400 leading-relaxed">
                Sign in to update your profile, change your password, and manage your orders.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer: sign-in / sign-out ── */}
        <div className="border-t border-neutral-800 px-4 py-4">
          {authenticated ? (
            <button
              type="button"
              onClick={() => { onSignOut(); onClose(); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-700/60 py-3 text-sm font-bold text-red-400 transition hover:bg-red-900/25 hover:border-red-600"
            >
              <LogOut size={16} /> Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { onSignIn(); onClose(); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition hover:bg-red-600"
            >
              <LogIn size={16} /> Sign in
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
