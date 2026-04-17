"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { masterPassCrypto } from "@/app/(protected)/masterpass/logic";
import { AppwriteService } from "@/lib/appwrite";
import { logError } from "@/lib/logger";
import toast from "react-hot-toast";

/**
 * Unlocks the vault using a registered passkey.
 * This decentralizes the MEK from the master password.
 */
export async function unlockWithPasskey(userId: string): Promise<boolean> {
  try {
    // 1. Get all keychain entries for the user
    const entries = await AppwriteService.listKeychainEntries(userId);
    const passkeyEntries = entries.filter(k => k.type === 'passkey');

    if (passkeyEntries.length === 0) {
      toast.error("No passkeys registered for this account.");
      return false;
    }

    // 2. Prepare authentication options
    // Challenge is random bytes
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeBase64 = btoa(String.fromCharCode(...challenge));

    const authOptions = {
      challenge: challengeBase64,
      rpId: "kylrix.space",
      allowCredentials: passkeyEntries.map(entry => ({
        id: entry.credentialId!,
        type: 'public-key' as const,
        transports: ['internal', 'usb', 'nfc', 'ble'] as AuthenticatorTransport[],
      })),
      userVerification: 'preferred' as UserVerificationRequirement,
      timeout: 60000,
    };

    // 3. Start WebAuthn authentication
    const authResp = await startAuthentication(authOptions);

    // 4. Find the matching keychain entry
    const matchingEntry = passkeyEntries.find(e => e.credentialId === authResp.id);
    if (!matchingEntry) {
      toast.error("Authenticated with an unregistered passkey.");
      return false;
    }

    // 5. Derive the wrapping key (MUST match registration logic)
    // registration logic: SHA-256(regResp.id + userId)
    const encoder = new TextEncoder();
    const credentialData = encoder.encode(authResp.id + userId);
    const kwrapSeed = await crypto.subtle.digest("SHA-256", credentialData);
    const kwrap = await crypto.subtle.importKey(
      "raw",
      kwrapSeed,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // 6. Unwrap the Master Encryption Key (MEK)
    const wrappedKeyBytes = new Uint8Array(
      atob(matchingEntry.wrappedKey).split("").map(c => c.charCodeAt(0))
    );

    // Extract IV (first 12 bytes - matched to registration logic)
    const iv = wrappedKeyBytes.slice(0, 12);
    const ciphertext = wrappedKeyBytes.slice(12);

    const mekBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      kwrap,
      ciphertext
    );

    // 7. Import the MEK into masterPassCrypto
    await masterPassCrypto.importKey(mekBytes);
    const success = await masterPassCrypto.unlockWithImportedKey();

    if (success) {
      toast.success("Vault unlocked via Passkey");
      return true;
    }

    return false;
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'NotAllowedError') {
      // User cancelled or timed out
      return false;
    }
    
    logError("Passkey unlock failed", err);
    toast.error(`Passkey unlock failed: ${err.message}`);
    return false;
  }
}
