"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAppwriteVault } from "@/context/appwrite-context";
import { MasterPassModal } from "@/components/overlays/MasterPassModal";
import { 
  Box, 
} from "@mui/material";

export default function MasterPassPage() {
  const { } = useAppwriteVault();
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl");

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: 'background.default',
      p: 3
    }}>
      <MasterPassModal 
        isOpen={true} 
        onClose={() => {
          // Navigation is handled by the unlock finalizer; this stays as a noop.
          if (callbackUrl) {
            window.location.href = callbackUrl;
          } else {
            router.replace("/dashboard");
          }
        }}
      />
    </Box>
  );
}
