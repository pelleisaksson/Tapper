// A home-screen app on iOS can stay alive in the background for days and keep
// running old code. When it comes back to the foreground, check whether a newer
// build is live and, if so, reload to pick it up.

const MIN_INTERVAL = 60_000;
let lastCheck = 0;

export async function checkForUpdate(): Promise<void> {
  if (!import.meta.env.PROD || Date.now() - lastCheck < MIN_INTERVAL) return;
  lastCheck = Date.now();
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (build && build !== __APP_BUILD__) {
      // Guard against a reload loop if the new page can't be fetched for some reason.
      const key = 'tapper.reloadedFor';
      try {
        if (sessionStorage.getItem(key) === build) return;
        sessionStorage.setItem(key, build);
      } catch { /* storage unavailable: reload anyway */ }
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update().catch(() => {});
      window.location.reload();
    }
  } catch {
    /* offline: try again next time */
  }
}

export function watchForUpdates(): void {
  checkForUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('focus', () => checkForUpdate());
}
