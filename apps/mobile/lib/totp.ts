import * as Crypto from "expo-crypto";

// TOTP (RFC 6238) built on HMAC-SHA1 (RFC 2104), ported from
// www/js/security_pages.js's Web Crypto based implementation. expo-crypto has
// no native HMAC primitive, so HMAC-SHA1 is composed here from its raw SHA-1
// digest() — standard RFC 2104 construction (ipad/opad XOR blocks).
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SHA1_BLOCK_SIZE = 64;

export function createTotpSecret(): string {
  const bytes = Crypto.getRandomBytes(10);
  let bits = "";
  bytes.forEach((b) => {
    bits += b.toString(2).padStart(8, "0");
  });
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  }
  return out.replace(/(.{4})/g, "$1 ").trim();
}

function base32ToBytes(secret: string): Uint8Array {
  let bits = "";
  secret
    .replace(/\s+/g, "")
    .toUpperCase()
    .split("")
    .forEach((ch) => {
      const v = B32.indexOf(ch);
      if (v >= 0) bits += v.toString(2).padStart(5, "0");
    });
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const digestBuf = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, data.buffer as ArrayBuffer);
  return new Uint8Array(digestBuf);
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  let keyBlock = key.length > SHA1_BLOCK_SIZE ? await sha1(key) : key;
  if (keyBlock.length < SHA1_BLOCK_SIZE) {
    const padded = new Uint8Array(SHA1_BLOCK_SIZE);
    padded.set(keyBlock);
    keyBlock = padded;
  }
  const ipad = new Uint8Array(SHA1_BLOCK_SIZE);
  const opad = new Uint8Array(SHA1_BLOCK_SIZE);
  for (let i = 0; i < SHA1_BLOCK_SIZE; i++) {
    ipad[i] = keyBlock[i] ^ 0x36;
    opad[i] = keyBlock[i] ^ 0x5c;
  }
  const innerInput = new Uint8Array(ipad.length + message.length);
  innerInput.set(ipad);
  innerInput.set(message, ipad.length);
  const innerHash = await sha1(innerInput);

  const outerInput = new Uint8Array(opad.length + innerHash.length);
  outerInput.set(opad);
  outerInput.set(innerHash, opad.length);
  return sha1(outerInput);
}

async function hotp(secret: string, counter: number): Promise<string> {
  const keyBytes = base32ToBytes(secret);
  const counterBytes = new Uint8Array(8);
  const view = new DataView(counterBytes.buffer);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high);
  view.setUint32(4, low);
  const sig = await hmacSha1(keyBytes, counterBytes);
  const off = sig[sig.length - 1] & 15;
  const bin = ((sig[off] & 127) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
  return String(bin % 1000000).padStart(6, "0");
}

export function totpCode(secret: string, offset = 0): Promise<string> {
  return hotp(secret, Math.floor(Date.now() / 30000) + offset);
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const clean = String(code || "").replace(/\D/g, "");
  if (!secret || clean.length !== 6) return false;
  for (const offset of [-1, 0, 1]) {
    if ((await totpCode(secret, offset)) === clean) return true;
  }
  return false;
}

export function totpUri(secret: string, email: string): string {
  const secretClean = secret.replace(/\s/g, "");
  return `otpauth://totp/PaMarket:${encodeURIComponent(email)}?secret=${secretClean}&issuer=PaMarket`;
}
