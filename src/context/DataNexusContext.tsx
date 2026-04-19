"use client";

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { masterPassCrypto } from "@/app/(protected)/masterpass/logic";

/**
 * KYLRIX VAULT DATA NEXUS
 * A high-performance, local-first caching layer for the Password Manager.
 * Security: Encrypted persistent storage (localStorage) + Volatile decrypted memory.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface DataNexusContextType {
    getCachedData: <T>(key: string, ttl?: number) => Promise<T | null>;
    setCachedData: <T>(key: string, data: T, ttl?: number) => Promise<void>;
    fetchOptimized: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<T>;
    invalidate: (key: string) => void;
    purge: () => void;
}

const DataNexusContext = createContext<DataNexusContextType | undefined>(undefined);

const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes default TTL for vault data

export function DataNexusProvider({ children }: { children: ReactNode }) {
    // In-memory cache for decrypted ultra-fast access (volatile)
    const memoryCache = useRef<Map<string, CacheEntry<any>>>(new Map());
    // Active request tracking for deduplication
    const activeRequests = useRef<Map<string, Promise<any>>>(new Map());

    const purge = useCallback(() => {
        memoryCache.current.clear();
        console.log('[Nexus] Volatile memory cache purged.');
    }, []);

    // Wipe memory cache whenever the vault is locked
    useEffect(() => {
        const handleVaultLocked = () => {
            purge();
        };
        window.addEventListener("vault-locked", handleVaultLocked);
        return () => window.removeEventListener("vault-locked", handleVaultLocked);
    }, [purge]);

    const getCachedData = useCallback(async <T,>(key: string, ttl: number = DEFAULT_TTL): Promise<T | null> => {
        // 1. Check memory cache first (Decrypted, Volatile)
        const memoryEntry = memoryCache.current.get(key);
        const now = Date.now();

        if (memoryEntry && (now - memoryEntry.timestamp < ttl)) {
            return memoryEntry.data;
        }

        // 2. Check localStorage for persistent encrypted cache
        if (typeof window !== 'undefined') {
            try {
                const persisted = localStorage.getItem(`v_nexus_${key}`);
                if (persisted && masterPassCrypto.isVaultUnlocked()) {
                    // PERSISTENCE SECURITY: Encrypted at rest
                    const decrypted = await masterPassCrypto.decryptData(persisted);
                    if (decrypted) {
                        const entry: CacheEntry<T> = JSON.parse(decrypted as string);
                        if (now - entry.timestamp < ttl) {
                            // Hydrate volatile memory cache
                            memoryCache.current.set(key, entry);
                            return entry.data;
                        }
                    }
                }
            } catch (e) {
                // Silently handle cases where vault is locked or data is corrupted
                console.warn(`[Nexus] Cache retrieval error for ${key}`);
            }
        }

        return null;
    }, []);

    const setCachedData = useCallback(async <T,>(key: string, data: T, _ttl?: number): Promise<void> => {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now()
        };

        // Update volatile memory (Decrypted)
        memoryCache.current.set(key, entry);

        // Update persistent store (Encrypted)
        if (typeof window !== 'undefined' && masterPassCrypto.isVaultUnlocked()) {
            try {
                // PERSISTENCE SECURITY: Encrypt before writing to localStorage
                const encrypted = await masterPassCrypto.encryptData(JSON.stringify(entry));
                localStorage.setItem(`v_nexus_${key}`, encrypted);
            } catch (e) {
                console.warn(`[Nexus] Persist error for ${key}`, e);
            }
        }
    }, []);

    const invalidate = useCallback((key: string) => {
        memoryCache.current.delete(key);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(`v_nexus_${key}`);
        }
    }, []);

    const fetchOptimized = useCallback(async <T,>(
        key: string, 
        fetcher: () => Promise<T>, 
        ttl: number = DEFAULT_TTL
    ): Promise<T> => {
        // 1. Check if we already have valid decrypted data
        const cached = await getCachedData<T>(key, ttl);
        if (cached) return cached;

        // 2. Deduplication: Check if an identical request is already in flight
        const existingRequest = activeRequests.current.get(key);
        if (existingRequest) return existingRequest;

        // 3. Perform the actual database fetch
        const request = (async () => {
            try {
                const data = await fetcher();
                await setCachedData(key, data, ttl);
                return data;
            } finally {
                // Cleanup active request tracker
                activeRequests.current.delete(key);
            }
        })();

        activeRequests.current.set(key, request);
        return request;
    }, [getCachedData, setCachedData]);

    return (
        <DataNexusContext.Provider value={{ getCachedData, setCachedData, fetchOptimized, invalidate, purge }}>
            {children}
        </DataNexusContext.Provider>
    );
}

export function useDataNexus() {
    const context = useContext(DataNexusContext);
    if (!context) throw new Error('useDataNexus must be used within DataNexusProvider');
    return context;
}
