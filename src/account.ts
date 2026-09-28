/**
 * Creating a Blackbox account in the browser. The keys are made here, exactly as the desktop app
 * makes them, so the server never sees the password or anything it could decrypt with.
 *
 * This is a copy of the registration half of the app's src/main/crypto.ts and account.ts (private
 * repo). The formats must stay identical: if the app changes how it derives or seals keys, change
 * this file in the same release.
 *
 *   password --Argon2id--> root --crypto_kdf--> authKey (sent; the server stores a hash)
 *                                           \-> masterKey (seals the private keys, never sent)
 *   recovery key --crypto_kdf--> recovery authKey + a key that also seals the private keys
 */
import type _sodium from 'libsodium-wrappers-sumo'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'https://blackbox.204-168-250-227.sslip.io').replace(/\/+$/, '')

export const MIN_PASSWORD = 10

type Sodium = typeof _sodium
let sodiumPromise: Promise<Sodium> | null = null

/** libsodium is large (it carries Argon2), so it loads only when someone starts signing up. */
export function loadSodium(): Promise<Sodium> {
  sodiumPromise ??= import('libsodium-wrappers-sumo').then(async (m) => {
    const sodium = (m.default ?? m) as Sodium
    await sodium.ready
    return sodium
  })
  return sodiumPromise
}

interface SealedBlob {
  nonce: string
  ciphertext: string
}

interface KdfParams {
  alg: 'argon2id13'
  ops: number
  mem: number
  salt: string
}

export interface Tokens {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
  deviceId: string
}

// Crockford base32: no I, L, O or U, so it survives being read aloud or written down.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function recoveryKeyText(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out.match(/.{1,4}/g)!.join('-')
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

const FRIENDLY: Record<string, string> = {
  email_taken: 'An account with that email already exists. Sign in from the app instead.',
  rate_limited: 'Too many attempts. Wait a minute and try again.',
  bad_code: 'That code is not right. Check the latest email and try again.'
}

async function call<T>(method: string, path: string, body?: unknown, token?: string, keepalive = false): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive
    })
  } catch {
    throw new ApiError(0, 'offline', 'Could not reach the Blackbox server. Check your connection and try again.')
  }
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok) {
    const code = json?.code ?? 'error'
    throw new ApiError(res.status, code, FRIENDLY[code] ?? json?.error ?? `The server answered ${res.status}.`)
  }
  return json as T
}

export const normEmail = (email: string) => email.trim().toLowerCase()

export const validEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail(email))

export interface Registered {
  email: string
  recoveryKey: string
  tokens: Tokens
}

/**
 * Makes the account's keys and registers it. The session this opens is only used to verify the
 * email address, then signed out, so the desktop app becomes the account's first real device.
 */
export async function register(emailInput: string, password: string): Promise<Registered> {
  const email = normEmail(emailInput)
  const sodium = await loadSodium()
  const b64 = (u: Uint8Array) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL)

  // 64 MiB, 3 passes: the app's defaults.
  const kdf: KdfParams = { alg: 'argon2id13', ops: 3, mem: 64 * 1024 * 1024, salt: b64(sodium.randombytes_buf(16)) }
  const root = sodium.crypto_pwhash(32, password.normalize('NFC'), sodium.from_base64(kdf.salt, sodium.base64_variants.ORIGINAL), kdf.ops, kdf.mem, sodium.crypto_pwhash_ALG_ARGON2ID13)
  const authKey = sodium.crypto_kdf_derive_from_key(32, 1, 'bbx-auth', root)
  const masterKey = sodium.crypto_kdf_derive_from_key(32, 2, 'bbx-mstr', root)
  sodium.memzero(root)

  const enc = sodium.crypto_box_keypair()
  const sign = sodium.crypto_sign_keypair()
  const privateJson = JSON.stringify({ encSecretKey: b64(enc.privateKey), signSecretKey: b64(sign.privateKey) })
  const seal = (key: Uint8Array): SealedBlob => {
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
    return { nonce: b64(nonce), ciphertext: b64(sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(privateJson, 'bbx-user-keys', null, nonce, key)) }
  }

  const recoveryBytes = sodium.randombytes_buf(32)
  const recoveryKey = recoveryKeyText(recoveryBytes)
  const recoveryAuthKey = sodium.crypto_kdf_derive_from_key(32, 1, 'bbx-recv', recoveryBytes)
  const recoveryWrapKey = sodium.crypto_kdf_derive_from_key(32, 2, 'bbx-recv', recoveryBytes)

  const vaultKey = sodium.crypto_aead_xchacha20poly1305_ietf_keygen()
  const body = {
    email,
    authKey: b64(authKey),
    kdf,
    keys: { publicEncKey: b64(enc.publicKey), publicSignKey: b64(sign.publicKey), privateKeysEnc: seal(masterKey) },
    recoveryPrivateKeysEnc: seal(recoveryWrapKey),
    recoveryAuthKey: b64(recoveryAuthKey),
    personalVaultKey: b64(sodium.crypto_box_seal(vaultKey, enc.publicKey)),
    deviceName: 'Website sign-up'
  }
  const res = await call<{ tokens: Tokens }>('POST', '/auth/register', body)

  for (const secret of [masterKey, authKey, enc.privateKey, sign.privateKey, recoveryBytes, recoveryWrapKey, vaultKey]) sodium.memzero(secret)
  return { email, recoveryKey, tokens: res.tokens }
}

export const verifyEmail = (tokens: Tokens, code: string) => call<unknown>('POST', '/auth/verify', { code: code.replace(/\s/g, '') }, tokens.accessToken)

export const resendCode = (tokens: Tokens) => call<unknown>('POST', '/auth/verify/resend', undefined, tokens.accessToken)

/**
 * Signs the website's session out. While it stays signed in it counts as an approved device, and
 * the app's first sign-in would wait for an approval nobody can give from here.
 */
export const signOut = (tokens: Tokens, keepalive = false) => call<unknown>('POST', '/auth/logout', undefined, tokens.accessToken, keepalive).catch(() => {})
