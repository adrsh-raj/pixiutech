const MAGIC = "PIXIU-CIRCUIT-PROTOCOL/2"
const enc = new TextEncoder()
const dec = new TextDecoder()
const PBKDF2_ITERATIONS = 210_000

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomSource(): Crypto {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("This browser does not provide a secure random source.")
  }
  return crypto
}

function assertCrypto(): Crypto {
  const webCrypto = randomSource()
  if (!webCrypto.subtle) {
    throw new Error("Password-protected .pixiu files require a modern HTTPS browser.")
  }
  return webCrypto
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const webCrypto = assertCrypto()
  const material = await webCrypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return webCrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
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

  const lines = [
    MAGIC,
    "encoding=base64",
    "encryption=" + (protectedFile ? "AES-256-GCM" : "NONE"),
    "kdf=" + (protectedFile ? "PBKDF2-SHA256" : "NONE"),
    "iterations=" + (protectedFile ? PBKDF2_ITERATIONS : "0"),
    "salt=" + toBase64(salt),
    "iv=" + toBase64(iv),
    "payload=" + toBase64(ciphertext),
    "",
  ]
  return new Blob([lines.join("\n")], { type: "application/x-pixiu-circuit" })
}

export async function decodePixiuProtocol(text: string, password?: string): Promise<unknown> {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== MAGIC) return JSON.parse(text)

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

export const PIXIU_PROTOCOL_MAGIC = MAGIC
