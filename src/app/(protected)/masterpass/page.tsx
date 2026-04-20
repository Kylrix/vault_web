"use client";

import { Box } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { MasterPassModal } from "@/components/overlays/MasterPassModal";
import { useAppwriteVault } from "@/context/appwrite-context";

export default function MasterPassPage() {
  const { isAuthReady } = useAppwriteVault();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  if (!isAuthReady) {
    return <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }} />;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <MasterPassModal
        isOpen={true}
        successRoute={callbackUrl || "/dashboard"}
        canLookupKeychain={isAuthReady}
        onClose={() => {
          if (callbackUrl) {
            window.location.href = callbackUrl;
            return;
          }

          router.replace("/dashboard");
        }}
      />
    </Box>
  );
}
