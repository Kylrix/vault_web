"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  resetMasterpassAndWipe,
  logoutAppwrite,
  getCurrentUser,
} from "@/lib/appwrite";
import { getAuthOrigin, openAuthPopup } from "@/lib/authUrl";
import { masterPassCrypto } from "./(protected)/masterpass/logic";
import { logDebug, logWarn } from "@/lib/logger";
import { AppwriteContext } from "@/context/appwrite-context";

// Types
import type { Models } from "appwrite";

interface AppwriteError extends Error {
  code?: number;
  response?: unknown;
}

export function AppwriteProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [needsMasterPassword, setNeedsMasterPassword] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [idmWindowOpen, setIDMWindowOpen] = useState(false);
  const idmWindowRef = useRef<Window | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const verbose = process.env.NODE_ENV === "development";

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Fetch current user and check master password status
  const fetchUser = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setLoading(true);
    try {
      const account = await getCurrentUser();
      
      if (verbose)
        logDebug("[auth] account.get success", { hasAccount: !!account });

      if (account) {
        // Update user state first
        setUser(account);

        // Clear the auth=success param from URL if it exists
        if (window.location.search.includes('auth=success')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('auth');
          window.history.replaceState({}, '', url.toString());
        }

        const unlocked = masterPassCrypto.isVaultUnlocked();
        if (verbose)
          logDebug("[auth] master password status", {
            unlocked,
          });
        
        // Use pathname to skip forcing masterpass on specific pages
        const currentPathname = pathnameRef.current;
        const isAuthPage =
          currentPathname === "/" ||
          currentPathname?.startsWith("/masterpass");
        
        // The crypto lock state is the source of truth for whether the vault is usable.
        // If it's an auth page, we don't need to force the modal.
        if (isAuthPage) {
          setNeedsMasterPassword(false);
        } else {
          setNeedsMasterPassword(!unlocked);
        }
      } else {
        // Explicitly clear everything on failure
        setUser(null);
        setNeedsMasterPassword(false);
      }
      return account;
    } catch (err: unknown) {
      const e = err as AppwriteError;
      
      // Explicitly clear user on 401
      setUser(null);
      setNeedsMasterPassword(false);

      if (verbose) logWarn("[auth] account.get error", { error: e });
      return null;
    } finally {
      setLoading(false);
      setIsAuthReady(true);
    }
  }, [verbose]);

  const openIDMWindow = useCallback(async () => {
    if (typeof window === "undefined" || isAuthenticating) return;

    setIsAuthenticating(true);

    if (idmWindowRef.current && !idmWindowRef.current.closed) {
      idmWindowRef.current.focus();
      return;
    }

    try {
      const popup = openAuthPopup();
      if (popup) {
        idmWindowRef.current = popup;
        setIDMWindowOpen(true);
      } else {
        setIsAuthenticating(false);
      }
    } catch (error: unknown) {
      console.error("Failed to open IDM window:", error);
      setIsAuthenticating(false);
    }
  }, [router, isAuthenticating]);

  const closeIDMWindow = useCallback(() => {
    if (idmWindowRef.current && !idmWindowRef.current.closed) {
      idmWindowRef.current.close();
    }
    idmWindowRef.current = null;
    setIDMWindowOpen(false);
    setIsAuthenticating(false);
  }, []);

  // Listen for auth success messages from IDM
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const expectedOrigin = getAuthOrigin();
      if (event.origin !== expectedOrigin) return;

      if (event.data?.type === "idm:auth-success") {
        logDebug("[auth] Received auth success message from IDM");
        
        // Close the window first for better UX
        closeIDMWindow();
        setIsAuthenticating(false);
        
        // Refresh user state
        const account = await fetchUser();
        
        // Send authenticated users into the dashboard flow.
        if (account) {
          router.replace("/dashboard");
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchUser, closeIDMWindow, router]);

  // Poll for window closure as a fallback
  useEffect(() => {
    if (!idmWindowOpen) return;

    const interval = setInterval(() => {
      if (idmWindowRef.current && idmWindowRef.current.closed) {
        clearInterval(interval);
        idmWindowRef.current = null;
        setIDMWindowOpen(false);
        setIsAuthenticating(false);
        fetchUser();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [idmWindowOpen, fetchUser]);

  // Initial load and authentication check orchestration
  useEffect(() => {
    void fetchUser();

    // Listen for vault lock events
    const handleVaultLocked = () => {
      setTimeout(() => setNeedsMasterPassword(true), 0);
    };
    window.addEventListener("vault-locked", handleVaultLocked);

    // Listen for storage changes (multi-tab logout)
    const handleStorageChange = () => fetchUser();
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("vault-locked", handleVaultLocked);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [fetchUser]);

  const refresh = async () => {
    await fetchUser();
    // After refresh, re-calculate needsMasterPassword specifically
    const unlocked = masterPassCrypto.isVaultUnlocked();
    const currentPathname = pathnameRef.current;
    const isAuthPage =
      currentPathname === "/" ||
      currentPathname?.startsWith("/masterpass");
    
    if (isAuthPage) {
      setNeedsMasterPassword(false);
    } else {
      setNeedsMasterPassword(!unlocked);
    }
  };

  const logout = async () => {
    // 1. Immediately clear local security state to stop modal triggers
    setNeedsMasterPassword(false);
    masterPassCrypto.lock();
    
    // Clear ecosystem status as well
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("kylrix_vault_unlocked");
    }

    // 2. Perform the actual Appwrite logout
    await logoutAppwrite();
    
    // 3. Clear the user state and trigger a final refresh
    setUser(null);
  };

  const resetMasterpass = async () => {
    if (!user) return;
    await resetMasterpassAndWipe(user.$id);
    masterPassCrypto.lock();
    setNeedsMasterPassword(true);
  };

  const isVaultUnlocked = () => {
    const unlocked = masterPassCrypto.isVaultUnlocked();
    if (verbose) logDebug("[auth] vault unlock status", { unlocked });
    return unlocked;
  };

  return (
    <AppwriteContext.Provider
      value={{
        user,
        loading,
        isAuthenticating,
        isAuthenticated: !!user,
        isAuthReady,
        isVaultUnlocked,
        needsMasterPassword,
        logout,
        resetMasterpass,
        refresh,
        openIDMWindow,
        closeIDMWindow,
        idmWindowOpen,
      }}
    >
      {children}
    </AppwriteContext.Provider>
  );
}
