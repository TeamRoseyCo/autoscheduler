"use client";

import { SessionProvider } from "next-auth/react";
import { ChatAssistant } from "@/components/chat-assistant";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
      <ChatAssistant />
    </SessionProvider>
  );
}
