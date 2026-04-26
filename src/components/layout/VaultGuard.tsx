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
  const isLocked = !isAuthReady || needsMasterPassword || !isVaultUnlocked();

  return (
    <div
      style={{
        position: 'relative',
        filter: isLocked ? 'blur(14px) saturate(0.85)' : 'none',
        pointerEvents: isLocked ? 'none' : 'auto',
        userSelect: isLocked ? 'none' : 'auto',
        transition: 'filter 180ms ease',
      }}
      aria-busy={isLocked}
    >
      {children}
    </div>
  );
}
