// Reader for Adobe Swatch Exchange (.ase) files, e.g. exported from Adobe Color.

import { rgbToHex, type RGB } from './color';

export interface Swatch { name: string; hex: string }

function labToRgb(L: number, a: number, b: number): RGB {
  // CIE L*a*b* (D50, as in ASE) -> sRGB, via XYZ with Bradford D50->D65.
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  [x, y, z] = [f(x) * 0.96422, f(y), f(z) * 0.82521];
  const X = 0.9555766 * x - 0.0230393 * y + 0.0631636 * z;
  const Y = -0.0282895 * x + 1.0099416 * y + 0.0210077 * z;
  const Z = 0.0122982 * x - 0.020483 * y + 1.3299098 * z;
  const lin = [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z];
  return lin.map((c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)) as RGB;
}

/** All color swatches in the file, in order. Throws on a file that is not ASE. */
export function parseASE(buffer: ArrayBuffer): Swatch[] {
  const v = new DataView(buffer);
  if (v.byteLength < 12 || String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)) !== 'ASEF') {
    throw new Error('Filen är inte en .ase-fil (Adobe Swatch Exchange).');
  }
  const blocks = v.getUint32(8);
  const out: Swatch[] = [];
  let p = 12;
  for (let i = 0; i < blocks && p + 6 <= v.byteLength; i++) {
    const type = v.getUint16(p);
    const len = v.getUint32(p + 2);
    const start = p + 6;
    p = start + len;
    if (type !== 0x0001) continue; // group start/end
    let q = start;
    const nameLen = v.getUint16(q);
    q += 2;
    let name = '';
    for (let k = 0; k < nameLen; k++, q += 2) {
      const c = v.getUint16(q);
      if (c) name += String.fromCharCode(c);
    }
    const model = String.fromCharCode(v.getUint8(q), v.getUint8(q + 1), v.getUint8(q + 2), v.getUint8(q + 3));
    q += 4;
    const f = (k: number) => v.getFloat32(q + 4 * k);
    let rgb: RGB | null = null;
    if (model === 'RGB ') rgb = [f(0) * 255, f(1) * 255, f(2) * 255];
    else if (model === 'Gray') rgb = [f(0) * 255, f(0) * 255, f(0) * 255];
    else if (model === 'CMYK') {
      const k = f(3);
      rgb = [255 * (1 - f(0)) * (1 - k), 255 * (1 - f(1)) * (1 - k), 255 * (1 - f(2)) * (1 - k)];
    } else if (model === 'LAB ') rgb = labToRgb(f(0) * 100, f(1), f(2));
    if (rgb) out.push({ name, hex: rgbToHex(rgb) });
  }
  if (!out.length) throw new Error('Hittade inga färger i filen.');
  return out;
}
