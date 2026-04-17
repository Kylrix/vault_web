/**
 * Kylrix Security
 * Centralized security and encryption logic for the entire ecosystem.
 * Hosted by the ID node (Identity Management System).
 */

import { MeshProtocol } from './mesh';
import { tablesDB } from '../appwrite';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { Query, ID } from 'appwrite';

export class EcosystemSecurity {
  private static instance: EcosystemSecurity;
  private masterKey: CryptoKey | null = null;
  private identityKeyPair: CryptoKeyPair | null = null;
  private isUnlocked = false;
  private nodeId: string = 'vault';
  // SECURITY: Tab-specific secret (RAM-only) to protect against XSS (CVE-KYL-2026-005)
  private tabSessionSecret: Uint8Array | null = null;

  // Asymmetric keys for node identity (CVE-KYL-2026-006: Mesh Spoofing Mitigation)
  private signingKey: CryptoKeyPair | null = null;
  private nodeKeyRegistry: Map<string, CryptoKey> = new Map();

  // Constants aligned with Kylrix Vault for backward compatibility
  private static readonly PBKDF2_ITERATIONS = 600000;
  private static readonly SALT_SIZE = 32;
  private static readonly IV_SIZE = 16;
  private static readonly KEY_SIZE = 256;

  private static readonly PIN_ITERATIONS = 100000;
  private static readonly PIN_SALT_SIZE = 16;
  private static readonly SESSION_SALT_SIZE = 16;

  static getInstance(): EcosystemSecurity {
    if (!EcosystemSecurity.instance) {
      EcosystemSecurity.instance = new EcosystemSecurity();
    }
    return EcosystemSecurity.instance;
  }

  /**
   * Initialize security for a specific node
   */
  async init(nodeId: string) {
    this.nodeId = nodeId;
    this.listenForMeshDirectives();
    await this.getOrCreateNodeKeys();
  }

  getIdentityPrivateKey(): CryptoKey | null {
    return this.identityKeyPair?.privateKey ?? null;
  }

  getIdentityPublicKey(): CryptoKey | null {
    return this.identityKeyPair?.publicKey ?? null;
  }

  /**
   * Get or create this node's asymmetric identity keys
   */
  private async getOrCreateNodeKeys(): Promise<CryptoKeyPair> {
    if (this.signingKey) return this.signingKey;

    // In a production environment, these should be stored in IndexedDB for better security
    // and marked as non-extractable. For this prototype, we'll generate and store the 
    // public key in localStorage and keep the private key in memory (or derive it).
    // To survive refreshes, we'll store the pair if possible.

    // For now, we generate a new pair per session if not found
    this.signingKey = await crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false, // non-extractable private key
      ["sign", "verify"]
    );

    // Export and share public key (mocking the distribution)
    const pubKeyBuffer = await crypto.subtle.exportKey("spki", this.signingKey.publicKey);
    const pubKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyBuffer)));
    localStorage.setItem(`kylrix_node_pubkey_${this.nodeId}`, pubKeyBase64);

    return this.signingKey;
  }

  async ensureIdentityKeyPair(): Promise<CryptoKeyPair> {
    if (this.identityKeyPair) return this.identityKeyPair;

    this.identityKeyPair = await crypto.subtle.generateKey(
      {
        name: "X25519",
      },
      false,
      ["deriveKey", "deriveBits"],
    );

    return this.identityKeyPair;
  }

  async importIdentityKeyPair(keyPair: CryptoKeyPair): Promise<void> {
    this.identityKeyPair = keyPair;
  }

  /**
   * Sign a mesh message to prevent spoofing
   */
  async signMessage(payload: any, timestamp: number, msgId: string): Promise<string> {
    if (!this.signingKey) await this.getOrCreateNodeKeys();

    const dataToSign = new TextEncoder().encode(JSON.stringify(payload) + timestamp + msgId + this.nodeId);
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      this.signingKey!.privateKey,
      dataToSign
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Verify a mesh message signature
   */
  async verifyMessage(msg: any): Promise<boolean> {
    try {
      if (!msg.signature || !msg.sourceNode) return false;

      // 1. Get the sender's public key
      let pubKey = this.nodeKeyRegistry.get(msg.sourceNode);

      if (!pubKey) {
        // Mock: Try to fetch from shared storage (in reality, would be a secure ID node registry)
        const stored = localStorage.getItem(`kylrix_node_pubkey_${msg.sourceNode}`);
        if (!stored) return false; // Unknown node

        const pubKeyBuffer = new Uint8Array(atob(stored).split("").map(c => c.charCodeAt(0)));
        pubKey = await crypto.subtle.importKey(
          "spki",
          pubKeyBuffer,
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["verify"]
        );
        this.nodeKeyRegistry.set(msg.sourceNode, pubKey);
      }

      // 2. Verify signature
      const dataToVerify = new TextEncoder().encode(JSON.stringify(msg.payload) + msg.timestamp + msg.id + msg.sourceNode);
      const sigBuffer = new Uint8Array(atob(msg.signature).split("").map(c => c.charCodeAt(0)));

      return await crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        pubKey,
        sigBuffer,
        dataToVerify
      );
    } catch (_e: unknown) {
      console.error("[Security] Signature verification failed", _e);
      return false;
    }
  }

  private listenForMeshDirectives() {
    if (typeof window === 'undefined') return;

    MeshProtocol.subscribe((msg) => {
      if (msg.type === 'COMMAND' && msg.payload.action === 'LOCK_SYSTEM') {
        this.lock();
      }
    });
  }

  private getOrCreateSessionSecret(): Uint8Array {
    if (typeof window === 'undefined') return new Uint8Array(32);
    if (!this.tabSessionSecret) {
      this.tabSessionSecret = crypto.getRandomValues(new Uint8Array(32));
    }
    return this.tabSessionSecret;
  }

  /**
   * Fetches the user's keychain directly from the password manager database.
   * This allows the app to be self-sufficient without a hard ID app redirect.
   */
  async fetchKeychain(userId: string) {
    try {
      const PW_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb';
      const KEYCHAIN_TABLE = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER?.KEYCHAIN || 'keychain';
      
      const res = await tablesDB.listDocuments(PW_DB, KEYCHAIN_TABLE, [
        Query.equal('userId', userId),
        Query.limit(1)
      ]);
      return res.documents[0] || null;
    } catch (_e: unknown) {
      console.error('[Security] Failed to fetch keychain:', _e);
      return null;
    }
  }

  /**
   * Derive key from password
   */
  public async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"],
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: EcosystemSecurity.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: EcosystemSecurity.KEY_SIZE },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    );
  }

  /**
   * Generate a random Master Encryption Key (MEK)
   */
  public async generateRandomMEK(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );
  }

  /**
   * Wrap MEK with password and salt
   */
  public async wrapMEK(mek: CryptoKey, password: string, salt: Uint8Array): Promise<string> {
    const authKey = await this.deriveKey(password, salt);
    const mekBytes = await crypto.subtle.exportKey("raw", mek);
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));

    const encryptedMek = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      authKey,
      mekBytes
    );

    const combined = new Uint8Array(iv.length + encryptedMek.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedMek), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Unwrap MEK with password and salt
   */
  public async unwrapMEK(wrappedKeyBase64: string, password: string, saltBase64: string): Promise<CryptoKey> {
    const salt = new Uint8Array(atob(saltBase64).split("").map(c => c.charCodeAt(0)));
    const authKey = await this.deriveKey(password, salt);

    const wrappedKeyBytes = new Uint8Array(atob(wrappedKeyBase64).split("").map(c => c.charCodeAt(0)));
    const iv = wrappedKeyBytes.slice(0, EcosystemSecurity.IV_SIZE);
    const ciphertext = wrappedKeyBytes.slice(EcosystemSecurity.IV_SIZE);

    const mekBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      authKey,
      ciphertext
    );

    return await crypto.subtle.importKey(
      "raw",
      mekBytes,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );
  }

  // Import a raw key and set it as the master key
  async importMasterKey(keyBytes: ArrayBuffer): Promise<boolean> {
    try {
      this.masterKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM", length: 256 },
        true, // Make it extractable
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
      );
      this.isUnlocked = true;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("kylrix_vault_unlocked", "true");
      }
      return true;
    } catch (_e) {
      console.error("[Security] Failed to import master key", _e);
      return false;
    }
  }

  getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }

  async unlock(password: string, keyChainEntry?: any): Promise<boolean> {
    try {
      if (!keyChainEntry) return false;

      const salt = new Uint8Array(
        atob(keyChainEntry.salt).split("").map(c => c.charCodeAt(0))
      );

      const authKey = await this.deriveKey(password, salt);
      const wrappedKeyBytes = new Uint8Array(
        atob(keyChainEntry.wrappedKey).split("").map(c => c.charCodeAt(0))
      );

      const iv = wrappedKeyBytes.slice(0, EcosystemSecurity.IV_SIZE);
      const ciphertext = wrappedKeyBytes.slice(EcosystemSecurity.IV_SIZE);

      const mekBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        authKey,
        ciphertext
      );

      this.masterKey = await crypto.subtle.importKey(
        "raw",
        mekBytes,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      this.isUnlocked = true;

      return true;
    } catch (_e: unknown) {
      console.error("[Security] Unlock failed", _e);
      return false;
    }
  }

  async encrypt(data: string): Promise<string> {
    if (!this.masterKey) throw new Error("Security vault locked");
    return this.encryptWithKey(data, this.masterKey);
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.masterKey) throw new Error("Security vault locked");
    return this.decryptWithKey(encryptedData, this.masterKey);
  }

  async encryptWithKey(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      plaintext,
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decryptWithKey(encryptedData: string, key: CryptoKey): Promise<string> {
    const combined = new Uint8Array(
      atob(encryptedData).split("").map((char) => char.charCodeAt(0)),
    );

    const iv = combined.slice(0, EcosystemSecurity.IV_SIZE);
    const encrypted = combined.slice(EcosystemSecurity.IV_SIZE);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encrypted,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Phase 1: Setup PIN Verifier (Disk-Bound)
   * Stores { PinSalt, PinHash } in localStorage.
   */
  async setupPinVerifier(pin: string): Promise<void> {
    if (typeof window === "undefined") return;

    const salt = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.PIN_SALT_SIZE));
    const hash = await this.derivePinHash(pin, salt);

    const verifier = {
      salt: btoa(String.fromCharCode(...salt)),
      hash: btoa(String.fromCharCode(...new Uint8Array(hash))),
    };

    localStorage.setItem("kylrix_pin_verifier", JSON.stringify(verifier));
  }

  /**
   * Phase 2: Ephemeral Wrap (RAM-Bound)
   * Wraps the MEK with an ephemeral key derived from PIN and SessionSalt.
   * Stores in sessionStorage.
   */
  async piggybackSession(pin: string): Promise<void> {
    if (!this.masterKey || typeof window === "undefined") return;

    const sessionSalt = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.SESSION_SALT_SIZE));
    const ephemeralKey = await this.deriveEphemeralKey(pin, sessionSalt);

    const rawMek = await crypto.subtle.exportKey("raw", this.masterKey);
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));

    const wrappedMek = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      ephemeralKey,
      rawMek
    );

    const combined = new Uint8Array(iv.length + wrappedMek.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(wrappedMek), iv.length);

    const ephemeralData = {
      wrappedMek: btoa(String.fromCharCode(...combined)),
      sessionSalt: btoa(String.fromCharCode(...sessionSalt)),
    };

    sessionStorage.setItem("kylrix_ephemeral_session", JSON.stringify(ephemeralData));
  }

  /**
   * Phase 3: Unlock Session with PIN
   * Reconstructs the MEK from ephemeral RAM using the PIN.
   */
  async unlockWithPin(pin: string): Promise<boolean> {
    if (typeof window === "undefined") return false;

    const verifierStr = localStorage.getItem("kylrix_pin_verifier");
    const ephemeralStr = sessionStorage.getItem("kylrix_ephemeral_session");

    if (!verifierStr || !ephemeralStr) return false;

    try {
      // 1. Verify PIN against disk verifier
      const verifier = JSON.parse(verifierStr);
      const salt = new Uint8Array(atob(verifier.salt).split("").map(c => c.charCodeAt(0)));
      const expectedHash = verifier.hash;
      const actualHash = btoa(String.fromCharCode(...new Uint8Array(await this.derivePinHash(pin, salt))));

      if (actualHash !== expectedHash) {
        return false;
      }

      // 2. Unwrap MEK from ephemeral storage
      const ephemeral = JSON.parse(ephemeralStr);
      const sessionSalt = new Uint8Array(atob(ephemeral.sessionSalt).split("").map(c => c.charCodeAt(0)));
      const ephemeralKey = await this.deriveEphemeralKey(pin, sessionSalt);

      const wrappedMekBytes = new Uint8Array(atob(ephemeral.wrappedMek).split("").map(c => c.charCodeAt(0)));
      const iv = wrappedMekBytes.slice(0, EcosystemSecurity.IV_SIZE);
      const ciphertext = wrappedMekBytes.slice(EcosystemSecurity.IV_SIZE);

      const rawMek = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        ephemeralKey,
        ciphertext
      );

      this.masterKey = await crypto.subtle.importKey(
        "raw",
        rawMek,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      this.isUnlocked = true;
      return true;
    } catch (_e: unknown) {
      console.error("[Security] PIN unlock failed", _e);
      return false;
    }
  }

  isPinSet(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("kylrix_pin_verifier");
  }

  private async derivePinHash(pin: string, salt: Uint8Array): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    return crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: EcosystemSecurity.PIN_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
  }

  private async deriveEphemeralKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const sessionSecret = this.getOrCreateSessionSecret();

    // Mix PIN with tab-specific Session Secret for entropy (XSS-safe)
    const pinBytes = encoder.encode(pin);
    const combined = new Uint8Array(pinBytes.length + sessionSecret.length);
    combined.set(pinBytes);
    combined.set(sessionSecret, pinBytes.length);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      combined,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: 10000, // Optimized for instant (<20ms) unlock speed
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false, // SECURITY: Non-extractable. Key cannot be exported by XSS.
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Generates or retrieves the user's E2E Identity (X25519)
   */
  async ensureE2EIdentity(userId: string): Promise<string | null> {
    if (!this.masterKey) throw new Error("Unlock required for E2E Identity");

    const PW_DB = APPWRITE_CONFIG.DATABASES.VAULT || 'passwordManagerDb';
    const IDENTITIES_TABLE = 'identities';
    const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT || 'chat';
    const CHAT_USERS_TABLE = 'users';

    try {
      const res = await tablesDB.listDocuments(PW_DB, IDENTITIES_TABLE, [
        Query.equal('userId', userId),
        Query.equal('identityType', 'e2e_connect'),
        Query.limit(1)
      ]);

      if (res.total > 0) {
        const doc = res.documents[0];
        // Unwrap private key
        const decryptedPriv = await this.decrypt(doc.passkeyBlob);
        const privKeyBytes = new Uint8Array(atob(decryptedPriv).split("").map(c => c.charCodeAt(0)));

        const privKey = await crypto.subtle.importKey("pkcs8", privKeyBytes, { name: "X25519" }, true, ["deriveKey", "deriveBits"]);
        const pubKeyBytes = new Uint8Array(atob(doc.publicKey).split("").map(c => c.charCodeAt(0)));
        const pubKey = await crypto.subtle.importKey("raw", pubKeyBytes, { name: "X25519" }, true, []);

        this.identityKeyPair = { publicKey: pubKey, privateKey: privKey };

        try {
          try {
            const uDoc = await tablesDB.getDocument(CHAT_DB, CHAT_USERS_TABLE, userId);
            if (uDoc) {
              await tablesDB.updateDocument(CHAT_DB, CHAT_USERS_TABLE, uDoc.$id, {
                publicKey: doc.publicKey
              });
            }
          } catch (_e) {
            // Ignore if document not found
            console.warn("Failed to find chat user", _e);
          }
        } catch (_e) {
          console.warn("Failed to publish existing public key to chat.users", _e);
        }

        return doc.publicKey;
      }

      // Generate new pair
      const pair = (await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveKey", "deriveBits"])) as CryptoKeyPair;
      const privExport = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
      const pubExport = await crypto.subtle.exportKey("raw", pair.publicKey);

      const pubBase64 = btoa(String.fromCharCode(...new Uint8Array(pubExport)));
      const privBase64 = btoa(String.fromCharCode(...new Uint8Array(privExport)));
      const encryptedPriv = await this.encrypt(privBase64);

      await tablesDB.createDocument(PW_DB, IDENTITIES_TABLE, ID.unique(), {
        userId,
        identityType: 'e2e_connect',
        label: 'Connect E2E Identity',
        publicKey: pubBase64,
        passkeyBlob: encryptedPriv,
        createdAt: new Date().toISOString()
      });

      this.identityKeyPair = pair;

      try {
        try {
          const uDoc = await tablesDB.getDocument(CHAT_DB, CHAT_USERS_TABLE, userId);
          if (uDoc) {
            await tablesDB.updateDocument(CHAT_DB, CHAT_USERS_TABLE, uDoc.$id, {
              publicKey: pubBase64
            });
          }
        } catch (_e) {
          // Ignore if document not found
          console.warn("Failed to find chat user", _e);
        }
      } catch (_e) {
        console.warn("Failed to publish public key to chat.users", _e);
      }

      return pubBase64;
    } catch (_e: unknown) {
      console.error('[Security] Identity sync failed:', _e);
      return null;
    }
  }

  lock() {
    this.masterKey = null;
    this.identityKeyPair = null;
    this.isUnlocked = false;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("kylrix_vault_unlocked");
      // We DO NOT remove kylrix_ephemeral_session here, 
      // as the PIN is meant to unlock the system when it's locked.
      // It should only be purged on "Purge" (tab close/process exit).
    }
  }

  get status() {
    return {
      isUnlocked: this.isUnlocked,
      hasKey: !!this.masterKey,
      hasIdentity: !!this.identityKeyPair
    };
  }
}

export const ecosystemSecurity = EcosystemSecurity.getInstance();
