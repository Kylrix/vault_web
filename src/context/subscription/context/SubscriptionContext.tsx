'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { 
  SubscriptionTier, 
  PaymentMethod, 
  RegionConfig, 
  PPP_DATA, 
  calculateSubscriptionPrice 
} from '../lib/ppp';
import { getCurrentUser } from '@/lib/appwrite';

interface SubscriptionState {
  currentTier: SubscriptionTier | 'FREE';
  detectedRegion: RegionConfig & { countryCode: string };
  paymentMethod: PaymentMethod;
  isLoading: boolean;
  prices: Record<SubscriptionTier, number>;
  setPaymentMethod: (method: PaymentMethod) => void;
  setRegion: (countryCode: string) => void;
  refreshPrices: () => void;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ 
  children,
  endpoint: _endpoint = 'https://fra.cloud.appwrite.io/v1',
  projectId: _projectId = '67fe9627001d97e37ef3'
}: { 
  children: React.ReactNode,
  endpoint?: string,
  projectId?: string
}) {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | 'FREE'>('FREE');
  const [regionCode, setRegionCode] = useState<string>('DEFAULT');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CRYPTO');
  const [isLoading, setIsLoading] = useState(true);

  const detectedRegion = useMemo(() => {
    const data = PPP_DATA[regionCode] || PPP_DATA.DEFAULT;
    return { ...data, countryCode: regionCode === 'DEFAULT' ? 'US' : regionCode };
  }, [regionCode]);

  const prices = useMemo(() => ({
    PRO: calculateSubscriptionPrice('PRO', regionCode, paymentMethod),
  }), [regionCode, paymentMethod]);

  useEffect(() => {
    const initSubscription = async () => {
      try {
        const currentUser = await getCurrentUser();
        const prefs = currentUser?.prefs || {};
        if (prefs && prefs.tier) {
          setCurrentTier(prefs.tier as SubscriptionTier);
        } else {
          setCurrentTier('FREE');
        }

        if (prefs && prefs.region && PPP_DATA[prefs.region]) {
          setRegionCode(prefs.region);
        } else {
          // Fallback to IP detection if no pref
          try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            if (data.country_code && PPP_DATA[data.country_code]) {
              setRegionCode(data.country_code);
            }
          } catch (e) {
            console.error('IP detection failed', e);
          }
        }

        setIsLoading(false);
      } catch (error) {
        setCurrentTier('FREE');
        // Still try IP detection for logged out users
        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          if (data.country_code && PPP_DATA[data.country_code]) {
            setRegionCode(data.country_code);
          }
        } catch (e) {}
        setIsLoading(false);
      }
    };
    initSubscription();
  }, []);

  const value: SubscriptionState = {
    currentTier,
    detectedRegion,
    paymentMethod,
    isLoading,
    prices,
    setPaymentMethod,
    setRegion: setRegionCode,
    refreshPrices: () => {},
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
