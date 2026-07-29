/**
 * ASCII-safe Base64 encoder for PAT Basic auth.
 * Avoids `btoa` / `Buffer` so the same helper runs in browser, Node, and RN.
 */
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encodeBase64Ascii(input: string): string {
  let output = '';
  let i = 0;

  while (i < input.length) {
    const c1 = input.charCodeAt(i++);
    const c2 = i < input.length ? input.charCodeAt(i++) : NaN;
    const c3 = i < input.length ? input.charCodeAt(i++) : NaN;

    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (Number.isNaN(c2) ? 0 : c2 >> 4);
    const e3 = Number.isNaN(c2)
      ? 64
      : ((c2 & 15) << 2) | (Number.isNaN(c3) ? 0 : c3 >> 6);
    const e4 = Number.isNaN(c3) ? 64 : c3 & 63;

    output +=
      BASE64_ALPHABET.charAt(e1) +
      BASE64_ALPHABET.charAt(e2) +
      (e3 === 64 ? '=' : BASE64_ALPHABET.charAt(e3)) +
      (e4 === 64 ? '=' : BASE64_ALPHABET.charAt(e4));
  }

  return output;
}
