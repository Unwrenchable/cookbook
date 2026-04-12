"use client";

import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Navbar />
      {children}
    </Providers>
  );
}
