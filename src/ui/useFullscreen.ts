import { useCallback, useEffect, useState } from 'react';

type FsDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/** Fullscreen toggle where the browser supports it (Mac, iPad, Android; not iPhone). */
export function useFullscreen() {
  const doc = document as FsDoc;
  const supported = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  const current = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  const [active, setActive] = useState(current);

  useEffect(() => {
    const on = () => setActive(current());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (current()) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else {
        const el = document.documentElement as FsEl;
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* refused by the browser: nothing to do */
    }
  }, []);

  return { supported, active, toggle };
}
