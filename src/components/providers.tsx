"use client";

import { SessionProvider } from "next-auth/react";
import { ChatAssistant } from "@/components/chat-assistant";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ChatAssistant />
    </SessionProvider>
  );
}
