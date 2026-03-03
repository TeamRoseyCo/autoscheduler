"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIStudyPanelProps {
  courses: any[];
  upcomingExams: any[];
}

const QUICK_SUGGESTIONS = [
  { label: "Generate flashcards", prompt: "Generate flashcards for my upcoming exam topics" },
  { label: "Create study plan", prompt: "Create a study plan for my upcoming exams" },
  { label: "Summarize lectures", prompt: "Help me summarize my recent lecture notes" },
  { label: "Quiz me", prompt: "Quiz me on the material from my courses" },
];

export function AIStudyPanel({ courses, upcomingExams }: AIStudyPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: Message = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/uni/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: {
            courses: courses.map((c: any) => ({ code: c.code, name: c.name })),
            upcomingExams: upcomingExams.map((e: any) => ({
              title: e.title,
              course: e.course?.code,
              date: e.date,
            })),
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message || "I'm sorry, I couldn't generate a response. Please check your AI provider settings." }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Make sure your AI provider is configured in the main app settings."
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">AI Study Assistant</h1>

      {/* Context bar */}
      <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
        <span className="text-xs text-gray-500">Context:</span>
        {courses.slice(0, 5).map((c: any) => (
          <span key={c.id} className="px-2 py-0.5 rounded text-[10px] bg-[#2a2a3c] text-gray-400">
            {c.code}
          </span>
        ))}
        {upcomingExams.length > 0 && (
          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-400">
            {upcomingExams.length} upcoming exam{upcomingExams.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Quick suggestions */}
      {messages.length === 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {QUICK_SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => sendMessage(s.prompt)}
              className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c] hover:bg-[#1a1a2e] transition-colors text-left"
            >
              <span className="text-sm text-white">{s.label}</span>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.prompt}</p>
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      <div className="rounded-lg bg-[#12121c] border border-[#2a2a3c] overflow-hidden">
        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg mb-2">Ask me anything about your studies</p>
              <p className="text-gray-600 text-sm">I can help with study plans, flashcards, summaries, and more</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-[#1e1e30] text-gray-300 border border-[#2a2a3c] rounded-bl-sm"
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] rounded-bl-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2a3c] p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask about your studies..."
            disabled={loading}
            className="flex-1 px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
