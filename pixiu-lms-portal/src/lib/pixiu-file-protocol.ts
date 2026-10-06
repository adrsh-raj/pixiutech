const LEGACY_MAGIC = "PIXIU-CIRCUIT-PROTOCOL/2"
const BINARY_MAGIC = new Uint8Array([0x50, 0x58, 0x49, 0x55, 0x03, 0x00]) // PXIU v3\0
const BINARY_HEADER_SIZE = 43
const enc = new TextEncoder()
const dec = new TextDecoder()
const PBKDF2_ITERATIONS = 210_000
const MIN_IMPORT_KDF_ITERATIONS = 100_000
const MAX_IMPORT_KDF_ITERATIONS = 500_000

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomSource(): Crypto {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) throw new Error("This browser does not provide a secure random source.")
  return crypto
}

function assertCrypto(): Crypto {
  const webCrypto = randomSource()
  if (!webCrypto.subtle) throw new Error("Password-protected .pixiu files require a modern HTTPS browser.")
  return webCrypto
}

async function deriveKey(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const webCrypto = assertCrypto()
  const material = await webCrypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
  return webCrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

function hasBinaryMagic(bytes: Uint8Array): boolean {
  if (bytes.length < BINARY_MAGIC.length) return false
  for (let i = 0; i < BINARY_MAGIC.length; i += 1) if (bytes[i] !== BINARY_MAGIC[i]) return false
  return true
}

async function decodeLegacyText(text: string, password?: string): Promise<unknown> {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== LEGACY_MAGIC) return JSON.parse(text)
  const values = new Map<string, string>()
  for (const line of lines.slice(1)) {
    const eq = line.indexOf("=")
    if (eq > 0) values.set(line.slice(0, eq), line.slice(eq + 1))
  }
  const encryption = values.get("encryption")
  const payload = values.get("payload")
  if (!payload) throw new Error("Pixiu project payload is missing or corrupted.")
  let plaintext = fromBase64(payload)
  if (encryption === "AES-256-GCM") {
    if (!password) throw new Error("PASSWORD_REQUIRED")
    const salt = fromBase64(values.get("salt") ?? "")
    const iv = fromBase64(values.get("iv") ?? "")
    try {
      const key = await deriveKey(password, salt)
      plaintext = new Uint8Array(await assertCrypto().subtle.decrypt({ name: "AES-GCM", iv }, key, plaintext))
    } catch {
      throw new Error("WRONG_PASSWORD")
    }
  } else if (encryption !== "NONE") {
    throw new Error("Unsupported Pixiu project encryption.")
  }
  return JSON.parse(dec.decode(plaintext))
}

export async function encodePixiuProtocol(payload: unknown, password?: string): Promise<Blob> {
  const webCrypto = randomSource()
  const plaintext = enc.encode(JSON.stringify(payload))
  const salt = webCrypto.getRandomValues(new Uint8Array(16))
  const iv = webCrypto.getRandomValues(new Uint8Array(12))
  const protectedFile = Boolean(password)
  let ciphertext = plaintext
  if (protectedFile) {
    if ((password ?? "").length < 4) throw new Error("Protected .pixiu files need a password of at least 4 characters.")
    const key = await deriveKey(password!, salt)
    ciphertext = new Uint8Array(await webCrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext))
  }
  const header = new Uint8Array(BINARY_HEADER_SIZE)
  header.set(BINARY_MAGIC, 0)
  header[6] = protectedFile ? 1 : 0
  const view = new DataView(header.buffer)
  view.setUint32(7, protectedFile ? PBKDF2_ITERATIONS : 0, false)
  header.set(salt, 11)
  header.set(iv, 27)
  view.setUint32(39, ciphertext.byteLength, false)
  return new Blob([header, ciphertext], { type: "application/octet-stream" })
}

export async function decodePixiuProtocol(input: string | ArrayBuffer | Uint8Array, password?: string): Promise<unknown> {
  if (typeof input === "string") return await decodeLegacyText(input, password)
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  if (!hasBinaryMagic(bytes)) return await decodeLegacyText(dec.decode(bytes), password)
  if (bytes.length < BINARY_HEADER_SIZE) throw new Error("Pixiu project file is truncated or corrupted.")
  const flags = bytes[6]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const iterations = view.getUint32(7, false)
  const payloadLength = view.getUint32(39, false)
  if (flags !== 0 && flags !== 1) throw new Error("Unsupported Pixiu project security mode.")
  if (flags === 1 && (iterations < MIN_IMPORT_KDF_ITERATIONS || iterations > MAX_IMPORT_KDF_ITERATIONS)) throw new Error("Unsupported Pixiu project security parameters.")
  if (payloadLength <= 0 || payloadLength !== bytes.byteLength - BINARY_HEADER_SIZE) throw new Error("Pixiu project payload is missing or corrupted.")
  const salt = bytes.slice(11, 27)
  const iv = bytes.slice(27, 39)
  let plaintext = bytes.slice(BINARY_HEADER_SIZE)
  if (flags === 1) {
    if (!password) throw new Error("PASSWORD_REQUIRED")
    try {
      const key = await deriveKey(password, salt, iterations)
      plaintext = new Uint8Array(await assertCrypto().subtle.decrypt({ name: "AES-GCM", iv }, key, plaintext))
    } catch {
      throw new Error("WRONG_PASSWORD")
    }
  }
  try {
    return JSON.parse(dec.decode(plaintext))
  } catch {
    throw new Error("Pixiu project payload is invalid or corrupted.")
  }
}

export const PIXIU_PROTOCOL_MAGIC = "PIXIU-CIRCUIT-PROTOCOL/3"
export const PIXIU_PROTOCOL_BINARY_MAGIC = BINARY_MAGIC