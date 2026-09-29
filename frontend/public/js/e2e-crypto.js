let _roomKey = null; // cached CryptoKey for this session

// ─────────────────────────────────────────────────────────────────
// PUBLIC: initialise the room key (call once, before any encrypt/decrypt)
// ─────────────────────────────────────────────────────────────────
async function initRoomKey(roomId) {
  const enc = new TextEncoder();

  // 1. Import the raw room ID string as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(roomId),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // 2. Derive a 256-bit AES-GCM key
  //    Salt is fixed per-room so every participant derives the same key.
  //    Using the roomId itself as salt is intentional here — the secrecy
  //    comes from the room ID being unguessable, not from a hidden salt.
  _roomKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("serene-salt-" + roomId),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,          // not extractable — key never leaves the browser
    ["encrypt", "decrypt"]
  );

  console.log("🔐 E2E: Room key derived successfully.");
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: encrypt a plaintext string → returns a base64 string
//         Format stored in Firestore:  "<base64-iv>:<base64-ciphertext>"
// ─────────────────────────────────────────────────────────────────
async function encrypt(plaintext) {
  if (!_roomKey) throw new Error("E2E: Room key not initialised. Call initRoomKey() first.");

  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit random IV

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    _roomKey,
    enc.encode(plaintext)
  );

  const ivB64     = bufferToBase64(iv);
  const cipherB64 = bufferToBase64(new Uint8Array(cipherBuffer));

  return `${ivB64}:${cipherB64}`;
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: decrypt a base64 string → returns plaintext
//         Returns "[encrypted message]" gracefully if decryption fails
//         (e.g. old messages from before E2E was added)
// ─────────────────────────────────────────────────────────────────
async function decrypt(ciphertext) {
  if (!_roomKey) throw new Error("E2E: Room key not initialised. Call initRoomKey() first.");

  // Handle legacy unencrypted messages (no ":" separator)
  if (!ciphertext || !ciphertext.includes(":")) return ciphertext;

  try {
    const [ivB64, cipherB64] = ciphertext.split(":");
    const iv           = base64ToBuffer(ivB64);
    const cipherBuffer = base64ToBuffer(cipherB64);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      _roomKey,
      cipherBuffer
    );

    return new TextDecoder().decode(plainBuffer);
  } catch (e) {
    console.warn("E2E: Decryption failed for a message.", e);
    return "[encrypted message]";
  }
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...buffer));
}

function base64ToBuffer(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
