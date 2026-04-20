"use client";

import { useAppwriteVault } from "@/context/appwrite-context";

/**
 * VaultGuard: Wrap protected pages/components with this to enforce
 * that the vault (crypto module) is unlocked. If not, redirect to /masterpass.
 *
 * Usage:
 *   <VaultGuard>
 *     ...protected content...
 *   </VaultGuard>
 */
export default function VaultGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isVaultUnlocked, needsMasterPassword, isAuthReady } = useAppwriteVault();

  if (!isAuthReady) {
    return null; // or a skeleton
  }

  if (needsMasterPassword || !isVaultUnlocked()) {
    return null;
  }

  return <>{children}</>;
}
