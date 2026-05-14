"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasCompletedOnboarding } from "@/lib/storage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasCompletedOnboarding() ? "/dashboard" : "/onboarding");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="text-sm">Loading LastMinuteLegends…</span>
      </div>
    </main>
  );
}
