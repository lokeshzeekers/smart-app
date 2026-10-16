import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Three small mobile-app helpers, mounted once in App:
 *  1. "New version available" - after a deploy, installed phones get this instead of
 *     silently reloading (a reload in the middle of a training attempt would lose the
 *     live view). The app also checks for a new version every hour and on return to the app.
 *  2. "You're offline" - live manikin data needs the network.
 *  3. "Install SMArT" - Android shows the real install prompt; iOS Safari gets the
 *     Share -> Add to Home Screen hint.
 */

const DISMISS_KEY = 'smart_install_dismissed';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc. */ }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkitOnly = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && webkitOnly;
}

export default function PwaStatus() {
  // Pages with the bottom navigation bar need the card lifted above it; login pages don't.
  const { pathname } = useLocation();
  const hasBottomNav = pathname.startsWith('/trainee/') || pathname.startsWith('/trainer/') && pathname !== '/trainer/login' || pathname.startsWith('/admin/');
  // ---- update available ----
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });

  // ---- offline ----
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ---- install ----
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(safeGet(DISMISS_KEY) === '1');
  const [installed, setInstalled] = useState(isStandalone());
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const showInstall = !installed && !dismissed && (installEvent || isIosSafari());

  function dismiss() { setDismissed(true); safeSet(DISMISS_KEY, '1'); }
  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'dismissed') dismiss();
  }

  return (
    <>
      {!online && (
        <div role="status" className="fixed top-0 inset-x-0 z-[60] bg-status-bad text-white text-center text-[13px] font-medium py-1.5 safe-top">
          You're offline - live manikin data is paused
        </div>
      )}

      {needRefresh && (
        <div role="alert" className="fixed top-3 inset-x-3 z-[60] max-w-md mx-auto bg-brand-900 text-white rounded-xl shadow-card px-4 py-3 flex items-center gap-3">
          <span className="flex-1 text-[13px]">A new version of SMArT is available.</span>
          <button onClick={() => updateServiceWorker(true)} className="bg-white text-brand-900 text-[13px] font-semibold rounded-lg px-3 py-1.5">Update</button>
          <button onClick={() => setNeedRefresh(false)} aria-label="Later" className="text-white/70 text-lg leading-none px-1">&times;</button>
        </div>
      )}

      {showInstall && (
        <div role="dialog" aria-label="Install SMArT" className={`fixed ${hasBottomNav ? 'bottom-20' : 'bottom-3'} inset-x-3 z-[55] max-w-md mx-auto bg-surface-card border border-surface-border rounded-2xl shadow-card px-4 py-3 flex items-center gap-3`}>
          <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-ink-900">Install SMArT</p>
            <p className="text-[12px] text-ink-500 leading-snug">
              {installEvent ? 'Add it to your home screen for full-screen, one-tap access.' : 'Tap Share, then "Add to Home Screen".'}
            </p>
          </div>
          {installEvent && (
            <button onClick={install} className="bg-brand-700 text-white text-[13px] font-semibold rounded-lg px-3 py-2">Install</button>
          )}
          <button onClick={dismiss} aria-label="Not now" className="text-ink-300 text-lg leading-none px-1">&times;</button>
        </div>
      )}
    </>
  );
}
