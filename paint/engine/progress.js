// Kompakte Kodierung des Malfortschritts (reine Logik, node-testbar).
//
//   encodeBits(Uint8Array[0/1]) -> base64 (1 Bit pro Form)
//   encodeOrder([3, 17, 5])     -> base64 (LEB128-Varints, Reihenfolge der Füllungen)

function toB64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

function fromB64(str) {
  try {
    const s = atob(str || '');
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

export function encodeBits(flags) {
  const n = flags.length;
  const bytes = new Uint8Array((n + 7) >> 3);
  for (let i = 0; i < n; i++) if (flags[i]) bytes[i >> 3] |= 1 << (i & 7);
  return toB64(bytes);
}

export function decodeBits(str, n) {
  const bytes = fromB64(str);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = bytes[i >> 3];
    if (b && (b >> (i & 7)) & 1) out[i] = 1;
  }
  return out;
}

export function encodeOrder(list) {
  const bytes = [];
  for (const v0 of list) {
    let v = Math.max(0, v0 | 0);
    do {
      let b = v & 0x7f;
      v >>>= 7;
      if (v) b |= 0x80;
      bytes.push(b);
    } while (v);
  }
  return toB64(Uint8Array.from(bytes));
}

export function decodeOrder(str) {
  const bytes = fromB64(str);
  const out = [];
  let v = 0, shift = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    v |= (b & 0x7f) << shift;
    if (b & 0x80) shift += 7;
    else { out.push(v >>> 0); v = 0; shift = 0; }
  }
  return out;
}

export function countBits(flags) {
  let c = 0;
  for (let i = 0; i < flags.length; i++) if (flags[i]) c++;
  return c;
}

/** Prozent (ganzzahlig, 100 nur wenn wirklich fertig). */
export function percent(done, total) {
  if (!total) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.floor((done / total) * 100));
}
