import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'ado_pat';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export function getPatCookieName(): string {
  return COOKIE_NAME;
}

/**
 * Derives a 256-bit key from ADO_SESSION_SECRET.
 * Missing secret is a hard failure in every environment (no silent fallback).
 */
function resolveSecret(): Buffer {
  const raw = process.env.ADO_SESSION_SECRET?.trim();
  if (!raw) {
    throw new Error(
      'ADO_SESSION_SECRET is required. Set it in .env.local (e.g. openssl rand -base64 32).',
    );
  }
  if (raw.length < 32) {
    throw new Error(
      'ADO_SESSION_SECRET must be at least 32 characters. Generate with: openssl rand -base64 32',
    );
  }
  return createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a PAT for storage in an HttpOnly cookie (AES-256-GCM).
 * Wire format: base64url(iv).base64url(tag).base64url(ciphertext)
 */
export function encryptPat(pat: string): string {
  const key = resolveSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(pat, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptPat(token: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = token.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;

    const key = resolveSecret();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    const pat = decrypted.toString('utf8').trim();
    return pat.length > 0 ? pat : null;
  } catch {
    return null;
  }
}

export function readEncryptedPatCookie(request: NextRequest): string | null {
  const value = request.cookies.get(COOKIE_NAME)?.value?.trim();
  return value && value.length > 0 ? value : null;
}

export function readPatFromRequest(request: NextRequest): string | null {
  const encrypted = readEncryptedPatCookie(request);
  if (!encrypted) return null;
  return decryptPat(encrypted);
}

export function applyPatCookie(response: NextResponse, pat: string): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: encryptPat(pat),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clears the PAT cookie (empty / expired). */
export function clearPatCookie(response: NextResponse): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function hasPatCookie(request: NextRequest): boolean {
  return readPatFromRequest(request) !== null;
}
