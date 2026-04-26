"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardPage from "@/app/(protected)/dashboard/page";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return <DashboardPage />;
}
