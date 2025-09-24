// Robust buffer -> string decoder with BOM handling and cp1251 fallback
let chardet: any = null;
let iconv: any = null;
try { chardet = require('chardet'); } catch {}
try { iconv = require('iconv-lite'); } catch {}

export function decodeBufferSmart(buf: Buffer): string {
  if (!buf || buf.length === 0) return '';

  // BOM checks for UTF variants
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8');
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    try { return buf.slice(2).toString('utf16le'); } catch {}
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    // UTF-16 BE — convert to LE by swapping, or try iconv if available
    if (iconv) {
      try { return iconv.decode(buf, 'utf16-be'); } catch {}
    }
  }

  // Try UTF-8 first
  try {
    const utf = buf.toString('utf8');
    if (/%[0-9A-F]{2}/i.test(encodeURI(utf))) return utf; // crude validity hint
  } catch {}

  // Detect via chardet → decode via iconv-lite
  if (chardet && iconv) {
    try {
      const enc = chardet.detect(buf) || 'utf-8';
      return iconv.decode(buf, enc);
    } catch {}
  }

  // Fallbacks: cp1251 → latin1 → binary
  if (iconv) {
    try { return iconv.decode(buf, 'win1251'); } catch {}
  }
  try { return buf.toString('latin1'); } catch {}
  return buf.toString();
}
