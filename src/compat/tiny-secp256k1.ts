import { Point, getPublicKey, getSharedSecret, recoverPublicKey, schnorr, sign, verify, hashes } from '@noble/secp256k1'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

hashes.sha256 = sha256
hashes.hmacSha256 = (key, msg) => hmac(sha256, key, msg)

const CURVE_N = Point.CURVE().n
const COMPRESSED_LENGTH = 33
const UNCOMPRESSED_LENGTH = 65

function toBytes(value: Uint8Array | Buffer): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value)
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`)
}

function bigIntTo32Bytes(value: bigint): Uint8Array {
  const normalized = ((value % CURVE_N) + CURVE_N) % CURVE_N
  const hex = normalized.toString(16).padStart(64, '0')
  return Uint8Array.from(hex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [])
}

function normalizeScalar(value: Uint8Array | Buffer): bigint {
  return bytesToBigInt(toBytes(value)) % CURVE_N
}

function pointFromInput(point: Uint8Array | Buffer): Point {
  return Point.fromBytes(toBytes(point))
}

export function isPrivate(privateKey: Uint8Array | Buffer): boolean {
  const key = toBytes(privateKey)
  return key.length === 32 && bytesToBigInt(key) > 0n && bytesToBigInt(key) < CURVE_N
}

export function isPoint(point: Uint8Array | Buffer): boolean {
  try {
    pointFromInput(point)
    return true
  } catch {
    return false
  }
}

export function isXOnlyPoint(point: Uint8Array | Buffer): boolean {
  const xOnly = toBytes(point)
  if (xOnly.length !== 32) return false

  const even = new Uint8Array(33)
  even[0] = 0x02
  even.set(xOnly, 1)

  const odd = new Uint8Array(33)
  odd[0] = 0x03
  odd.set(xOnly, 1)

  return isPoint(even) || isPoint(odd)
}

export function pointFromScalar(privateKey: Uint8Array | Buffer, compressed = true): Uint8Array | null {
  const key = toBytes(privateKey)
  if (!isPrivate(key)) return null
  const publicKey = getPublicKey(key, compressed)
  return new Uint8Array(publicKey)
}

export function pointAddScalar(point: Uint8Array | Buffer, tweak: Uint8Array | Buffer, compressed = true): Uint8Array | null {
  try {
    if (!isPoint(point)) return null
    const base = pointFromInput(point)
    const scalar = normalizeScalar(tweak)
    const tweaked = scalar === 0n ? base : base.add(Point.BASE.multiplyUnsafe(scalar))
    if (tweaked.is0()) return null
    return new Uint8Array(tweaked.toBytes(compressed))
  } catch {
    return null
  }
}

export function pointAdd(pointA: Uint8Array | Buffer, pointB: Uint8Array | Buffer, compressed = true): Uint8Array | null {
  if (!isPoint(pointA) || !isPoint(pointB)) return null
  const result = pointFromInput(pointA).add(pointFromInput(pointB))
  return new Uint8Array(result.toBytes(compressed))
}

export function pointMultiply(point: Uint8Array | Buffer, tweak: Uint8Array | Buffer, compressed = true): Uint8Array | null {
  try {
    if (!isPoint(point)) return null
    const result = pointFromInput(point).multiplyUnsafe(normalizeScalar(tweak))
    if (result.is0()) return null
    return new Uint8Array(result.toBytes(compressed))
  } catch {
    return null
  }
}

export function pointCompress(point: Uint8Array | Buffer, compressed = true): Uint8Array | null {
  try {
    if (!isPoint(point)) return null
    const result = pointFromInput(point)
    if (result.is0()) return null
    return new Uint8Array(result.toBytes(compressed))
  } catch {
    return null
  }
}

export function privateAdd(privateKey: Uint8Array | Buffer, tweak: Uint8Array | Buffer): Uint8Array | null {
  if (!isPrivate(privateKey)) return null
  const sum = (bytesToBigInt(toBytes(privateKey)) + normalizeScalar(tweak)) % CURVE_N
  if (sum === 0n) return null
  return bigIntTo32Bytes(sum)
}

export function privateSub(privateKey: Uint8Array | Buffer, tweak: Uint8Array | Buffer): Uint8Array | null {
  if (!isPrivate(privateKey)) return null
  const diff = (bytesToBigInt(toBytes(privateKey)) - normalizeScalar(tweak)) % CURVE_N
  if (diff === 0n) return null
  return bigIntTo32Bytes(diff)
}

export function privateNegate(privateKey: Uint8Array | Buffer): Uint8Array | null {
  if (!isPrivate(privateKey)) return null
  const negated = CURVE_N - bytesToBigInt(toBytes(privateKey))
  return bigIntTo32Bytes(negated)
}

export function signMessage(hash: Uint8Array | Buffer, privateKey: Uint8Array | Buffer, extraEntropy?: Uint8Array | Buffer): Uint8Array {
  const opts = extraEntropy ? { extraEntropy: toBytes(extraEntropy), prehash: false } : { prehash: false }
  return new Uint8Array(sign(toBytes(hash), toBytes(privateKey), opts))
}

export function verifySignature(hash: Uint8Array | Buffer, publicKey: Uint8Array | Buffer, signature: Uint8Array | Buffer): boolean {
  return verify(toBytes(signature), toBytes(hash), toBytes(publicKey), { prehash: false })
}

export function signSchnorrMessage(hash: Uint8Array | Buffer, privateKey: Uint8Array | Buffer, auxRand?: Uint8Array | Buffer): Uint8Array {
  return new Uint8Array(schnorr.sign(toBytes(hash), toBytes(privateKey), auxRand ? toBytes(auxRand) : undefined))
}

export function verifySchnorrSignature(hash: Uint8Array | Buffer, publicKey: Uint8Array | Buffer, signature: Uint8Array | Buffer): boolean {
  return schnorr.verify(toBytes(signature), toBytes(hash), toBytes(publicKey))
}

export function xOnlyPointFromPoint(point: Uint8Array | Buffer): Uint8Array | null {
  if (!isPoint(point)) return null
  const bytes = pointFromInput(point).toBytes(true)
  return bytes.length === COMPRESSED_LENGTH ? bytes.slice(1) : null
}

export function xOnlyPointFromScalar(privateKey: Uint8Array | Buffer): Uint8Array | null {
  const publicKey = pointFromScalar(privateKey, true)
  return publicKey ? publicKey.slice(1) : null
}

export function xOnlyPointAddTweak(xOnlyPoint: Uint8Array | Buffer, tweak: Uint8Array | Buffer): { xOnlyPubkey: Uint8Array; parity: number } | null {
  try {
    const xOnly = toBytes(xOnlyPoint)
    if (xOnly.length !== 32) return null
    const full = new Uint8Array(33)
    full[0] = 0x02
    full.set(xOnly, 1)
    const tweaked = pointAddScalar(full, tweak, true)
    if (!tweaked || tweaked.length !== 33) return null
    return { xOnlyPubkey: tweaked.slice(1), parity: tweaked[0] === 0x03 ? 1 : 0 }
  } catch {
    return null
  }
}

export function xOnlyPointFromPointLike(point: Uint8Array | Buffer): [Uint8Array, number] | null {
  const xOnly = xOnlyPointFromPoint(point)
  if (!xOnly) return null
  const p = pointFromInput(point)
  return [xOnly, p.y & 1n ? 1 : 0]
}

export function ecdh(privateKey: Uint8Array | Buffer, publicKey: Uint8Array | Buffer): Uint8Array | null {
  try {
    return new Uint8Array(getSharedSecret(toBytes(privateKey), toBytes(publicKey), true))
  } catch {
    return null
  }
}

export default {
  isXOnlyPoint,
  isPoint,
  isPrivate,
  pointAdd,
  pointAddScalar,
  pointCompress,
  pointFromScalar,
  pointMultiply,
  privateAdd,
  privateNegate,
  privateSub,
  sign: signMessage,
  verify: verifySignature,
  signSchnorr: signSchnorrMessage,
  verifySchnorr: verifySchnorrSignature,
  xOnlyPointAddTweak,
  xOnlyPointFromPoint,
  xOnlyPointFromScalar,
  ecdh,
}
