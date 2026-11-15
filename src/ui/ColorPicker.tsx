import { useLayoutEffect, useRef, useState } from 'react';
import { hexToHsv, hsvToHex, normalizeHex, readableText } from '../core/color';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  palette: string[];
}

/** Palette swatches, an HSV color wheel with a brightness slider, and a hex field. */
export function ColorPicker({ value, onChange, palette }: Props) {
  const [hex, setHex] = useState(value);
  const [wheelOpen, setWheelOpen] = useState(() => !palette.includes(value));
  const wheel = useRef<HTMLDivElement>(null);

  // Keep the text field in sync when the color changes from elsewhere.
  useLayoutEffect(() => setHex(value), [value]);

  // HSV is derived from the current color on every render. Grays and black have no
  // hue (and black no saturation), so remember the last ones to keep the marker put.
  const last = useRef({ h: 0, s: 0 });
  const cur = hexToHsv(value);
  if (cur.v > 0 && cur.s > 0) last.current.h = cur.h;
  if (cur.v > 0) last.current.s = cur.s;
  const h = cur.v > 0 && cur.s > 0 ? cur.h : last.current.h;
  const s = cur.v > 0 ? cur.s : last.current.s;
  const v = cur.v;

  function pickAt(clientX: number, clientY: number) {
    const el = wheel.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clientX - (r.left + r.width / 2);
    const y = clientY - (r.top + r.height / 2);
    const sat = Math.min(1, Math.hypot(x, y) / (r.width / 2));
    // 0° at the top, clockwise, matching the conic gradient.
    const hue = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
    last.current = { h: hue, s: sat };
    onChange(hsvToHex(hue, sat, v || 1));
  }

  const markerAngle = (h * Math.PI) / 180;

  return (
    <div className="color-picker">
      <div className="colors">
        {palette.map((col) => (
          <button
            key={col} type="button" className={`swatch ${value === col ? 'on' : ''}`} style={{ background: col }}
            aria-label={`Färg ${col}`} onClick={() => onChange(col)}
          />
        ))}
        <button
          type="button" className={`swatch custom ${wheelOpen ? 'open' : ''} ${!palette.includes(value) ? 'on' : ''}`}
          aria-label="Egen färg" aria-expanded={wheelOpen} onClick={() => setWheelOpen((o) => !o)}
        />
      </div>

      {wheelOpen && (
        <div className="wheel-row">
          <div
            ref={wheel} className="wheel" role="slider" aria-label="Färghjul: nyans och mättnad"
            aria-valuetext={value}
            style={{ '--v': v } as React.CSSProperties}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pickAt(e.clientX, e.clientY); }}
            onPointerMove={(e) => { if (e.buttons) pickAt(e.clientX, e.clientY); }}
          >
            <span
              className="wheel-marker"
              style={{
                left: `${50 + Math.sin(markerAngle) * s * 50}%`,
                top: `${50 - Math.cos(markerAngle) * s * 50}%`,
                background: value,
              }}
            />
          </div>
          <div className="wheel-side">
            <label className="field">
              <span>Ljushet</span>
              <input
                type="range" min={0} max={100} value={Math.round(v * 100)}
                style={{ '--hue': hsvToHex(h, s, 1) } as React.CSSProperties}
                className="brightness"
                onChange={(e) => onChange(hsvToHex(h, s, Number(e.target.value) / 100))}
              />
            </label>
            <label className="field">
              <span>Hex</span>
              <input
                className="hex-input" value={hex} maxLength={7} spellCheck={false} autoCapitalize="off" autoCorrect="off"
                onChange={(e) => {
                  setHex(e.target.value);
                  const n = normalizeHex(e.target.value);
                  if (n && n.length === 7 && e.target.value.replace('#', '').length === 6) onChange(n);
                }}
                onBlur={() => {
                  // Only commit what was typed (e.g. a short "#abc"); never overwrite a color
                  // just picked on the wheel, which is what moved focus away from this field.
                  const n = normalizeHex(hex);
                  if (!n) setHex(value);
                  else if (n !== value) onChange(n);
                }}
              />
            </label>
            <div className="color-preview" style={{ background: value, color: readableText(value) }}>Aa</div>
          </div>
        </div>
      )}
    </div>
  );
}
