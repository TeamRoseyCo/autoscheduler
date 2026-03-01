"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: { type: string; description: string; success: boolean }[];
};

// ─────────────────────────────────────────────────────────
// Cute chameleon SVG — side profile, looking right
// ─────────────────────────────────────────────────────────
function ChameleonIcon({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Curly tail */}
      <path
        d="M10 30 C5 34 3 41 8 45 C13 49 19 46 18 40 C17 37 14 36 12 38"
        stroke="#4ade80"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Body */}
      <ellipse cx="30" cy="30" rx="16" ry="11" fill="#22c55e" />
      {/* Belly — lighter highlight */}
      <ellipse cx="30" cy="33" rx="10" ry="5.5" fill="#86efac" opacity="0.6" />
      {/* Head / neck area */}
      <ellipse cx="44" cy="23" rx="11" ry="9.5" fill="#22c55e" />
      {/* Casque — the iconic triangular crest on top of the head */}
      <path
        d="M43 14 C46 8 52 9 54 14 C55 18 53 22 50 22 C47 22 43 20 43 16Z"
        fill="#16a34a"
      />
      {/* Eye outer ring — turreted chameleon eye, most recognisable feature */}
      <circle cx="49" cy="20" r="7" fill="#166534" />
      {/* Eye white */}
      <circle cx="49" cy="20" r="5.5" fill="white" />
      {/* Pupil */}
      <circle cx="50" cy="20" r="3.2" fill="#1a2e1a" />
      {/* Eye shine */}
      <circle cx="51.5" cy="18.6" r="1.2" fill="white" />
      {/* Nostril */}
      <circle cx="54" cy="25" r="0.9" fill="#166534" />
      {/* Back leg */}
      <path
        d="M26 39 L22 48"
        stroke="#16a34a"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Front leg */}
      <path
        d="M33 40 L31 48"
        stroke="#16a34a"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Body pattern dots */}
      <circle cx="25" cy="26" r="1.9" fill="#16a34a" opacity="0.5" />
      <circle cx="32" cy="24" r="1.5" fill="#16a34a" opacity="0.5" />
      <circle cx="20" cy="29" r="1.4" fill="#16a34a" opacity="0.4" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Quick-start suggestion chips shown on empty state
// ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: "📅 Today's schedule", message: "What's on my schedule today?" },
  { label: "✅ Add a task", message: "I need to add a task, can you help?" },
  { label: "📊 Workload check", message: "How's my workload looking?" },
  { label: "🎯 Prioritize", message: "Help me prioritize my tasks" },
];

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────
function getSlotKey(): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const hour = now.getHours();
  return `cam-${date}-${hour}`;
}

export function ChatAssistant() {
  const { data: session } = useSession();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);

  // Typing animation state
  const [typing, setTyping] = useState<{ id: string; displayed: number } | null>(null);
  const lastHandledMsgRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Scroll to bottom whenever messages / typing changes ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing?.displayed, scrollToBottom]);

  // ── Auto-focus input when panel opens ──
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
      setHasNewMsg(false);
    }
  }, [open]);

  // ── Fetch daily motivation on mount (once per day, cached in sessionStorage) ──
  useEffect(() => {
    if (!session?.user) return;

    const key = getSlotKey();
    const cached = sessionStorage.getItem(key);

    if (cached) {
      // Already shown today — restore the message and badge if chat hasn't been opened
      setMessages([{ id: "daily-motivation", role: "assistant", content: cached }]);
      setHasNewMsg(true);
      return;
    }

    // Fetch fresh motivation
    fetch("/api/motivate")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.message) return;
        sessionStorage.setItem(key, data.message);
        setMessages([{ id: "daily-motivation", role: "assistant", content: data.message }]);
        setHasNewMsg(true);
      })
      .catch(() => {/* silently ignore */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  // ── Start typing animation for new assistant messages ──
  useEffect(() => {
    const lastMsg = messages.at(-1);
    if (!lastMsg || lastMsg.role !== "assistant") return;
    if (lastMsg.id === lastHandledMsgRef.current) return;
    lastHandledMsgRef.current = lastMsg.id;
    setTyping({ id: lastMsg.id, displayed: 0 });

    if (!open) setHasNewMsg(true);
  }, [messages, open]);

  // ── Advance typing animation ──
  useEffect(() => {
    if (!typing) return;
    const msg = messages.find((m) => m.id === typing.id);
    if (!msg) return;
    if (typing.displayed >= msg.content.length) {
      setTyping(null);
      return;
    }

    const totalLen = msg.content.length;
    const advance = Math.max(1, Math.floor(totalLen / 80));
    const delay = Math.max(6, Math.min(22, 1800 / totalLen));

    const t = setTimeout(() => {
      setTyping((prev) =>
        prev
          ? { ...prev, displayed: Math.min(prev.displayed + advance, totalLen) }
          : null
      );
    }, delay);
    return () => clearTimeout(t);
  }, [typing, messages]);

  // ── What to display for a given message ──
  const getDisplayContent = (msg: ChatMessage) => {
    if (msg.role === "assistant" && typing?.id === msg.id) {
      return msg.content.slice(0, typing.displayed) + "▍";
    }
    return msg.content;
  };

  // ── Send a message ──
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: `Oops — ${data.error}`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.message,
            actions: data.actions,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "Connection issue — please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session?.user) return null;

  return (
    <>
      {/* ── Chat panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-4 z-50 flex flex-col"
          style={{ width: 380, height: 532 }}
        >
          <div className="flex flex-col h-full rounded-2xl border border-[#2a2a3c] bg-[#1a1a2e] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a3c] bg-gradient-to-r from-[#0f1f0f] to-[#1a1a2e]">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#0a2010] border border-green-900/60 flex-shrink-0">
                <ChameleonIcon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Cam</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-gray-500">AI scheduling assistant</span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-[#2a2a3c]"
                title="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                /* Empty state — welcome + suggestions */
                <div className="flex flex-col items-center justify-center h-full gap-5">
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="w-20 h-20 rounded-full bg-[#0a2010] border border-green-900/60 flex items-center justify-center shadow-lg">
                      <ChameleonIcon size={52} />
                    </div>
                    <div className="text-center">
                      <p className="text-white text-base font-semibold">Hey, I&apos;m Cam! 👋</p>
                      <p className="text-gray-400 text-xs mt-1 max-w-[240px] text-center leading-relaxed">
                        Your AI scheduling buddy. Ask me anything about your tasks and schedule.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => sendMessage(s.message)}
                        className="text-left rounded-xl border border-[#2a2a3c] bg-[#1e1e30] px-3 py-2.5 text-xs text-gray-300 hover:border-green-800/70 hover:text-green-300 hover:bg-[#152515] transition-all duration-150"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {/* Cam avatar */}
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0a2010] border border-green-900/50 flex items-center justify-center mt-0.5">
                        <ChameleonIcon size={18} />
                      </div>
                    )}

                    <div className="max-w-[78%] space-y-1.5">
                      {/* Bubble */}
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-tr-sm"
                            : "bg-[#1e1e30] text-gray-200 rounded-tl-sm border border-[#2a2a3c]"
                        }`}
                      >
                        {getDisplayContent(msg)}
                      </div>

                      {/* Action chips (task created, etc.) */}
                      {msg.actions?.map((action, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border ${
                            action.success
                              ? "bg-green-950/60 text-green-400 border-green-800/40"
                              : "bg-red-950/60 text-red-400 border-red-800/40"
                          }`}
                        >
                          {action.success ? "✅" : "❌"} {action.description}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0a2010] border border-green-900/50 flex items-center justify-center">
                    <ChameleonIcon size={18} />
                  </div>
                  <div className="bg-[#1e1e30] border border-[#2a2a3c] rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-4">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce"
                        style={{ animationDelay: "160ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce"
                        style={{ animationDelay: "320ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-3 pb-3 pt-2 border-t border-[#2a2a3c] bg-[#12121c]">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Ask Cam anything…"
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 resize-none rounded-xl bg-[#1e1e30] border border-[#2a2a3c] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-700/70 transition-colors disabled:opacity-50"
                  style={{ maxHeight: 120 }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-600 hover:bg-green-500 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  title="Send (Enter)"
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-center text-[10px] text-gray-700 mt-1.5">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full border-2 shadow-xl transition-all duration-200 flex items-center justify-center group ${
          open
            ? "bg-[#152515] border-green-600 scale-95 shadow-green-900/30"
            : "bg-[#0a2010] border-green-800 hover:border-green-500 hover:scale-110 hover:shadow-green-900/50"
        }`}
        style={
          !open
            ? {
                boxShadow:
                  "0 4px 24px rgba(34,197,94,0.18), 0 2px 8px rgba(0,0,0,0.5)",
              }
            : {}
        }
        title={open ? "Close Cam" : "Chat with Cam"}
      >
        {/* New-message notification dot */}
        {hasNewMsg && !open && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-[#12121c] animate-pulse" />
        )}

        {open ? (
          /* Down chevron when open */
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        ) : (
          <ChameleonIcon
            size={34}
            className="transition-transform duration-200 group-hover:scale-110"
          />
        )}
      </button>
    </>
  );
}
