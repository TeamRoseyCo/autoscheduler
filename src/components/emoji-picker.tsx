"use client";

import { useState, useRef, useEffect } from "react";
import { AppleEmoji } from "@/components/apple-emoji";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    label: "Work",
    emojis: ["\u{1F4BB}", "\u{270D}\uFE0F", "\u{1F4CA}", "\u{1F4CB}", "\u{1F4C1}", "\u{1F4DD}", "\u{1F4C8}", "\u{2699}\uFE0F"],
  },
  {
    label: "Communication",
    emojis: ["\u{1F4DE}", "\u{1F4E7}", "\u{1F4AC}", "\u{1F4E2}", "\u{1F4E8}", "\u{1F465}", "\u{1F91D}", "\u{1F4F1}"],
  },
  {
    label: "Creative",
    emojis: ["\u{1F3A8}", "\u{1F3B5}", "\u{1F3AC}", "\u{1F4F7}", "\u{1F4A1}", "\u{2728}", "\u{1F680}", "\u{1F9EA}"],
  },
  {
    label: "Life",
    emojis: ["\u{1F37D}\uFE0F", "\u{1F3C3}", "\u{1F4A4}", "\u{1F9D8}", "\u{2615}", "\u{1F4DA}", "\u{1F3E0}", "\u{2764}\uFE0F"],
  },
  {
    label: "Relationships",
    emojis: ["\u{1F48D}", "\u{1F491}", "\u{1F46A}", "\u{1F476}", "\u{1F46B}", "\u{1F618}", "\u{1F496}", "\u{1F4D6}"],
  },
  {
    label: "Misc",
    emojis: ["\u{2B50}", "\u{1F525}", "\u{2705}", "\u{274C}", "\u{1F4CC}", "\u{1F50D}", "\u{26A0}\uFE0F", "\u{1F3AF}"],
  },
];

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a3c] transition-colors text-sm"
        title="Add emoji"
      >
        <AppleEmoji emoji={"\u{1F642}"} size={18} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[280px] bg-[#1e1e30] border border-[#2a2a3c] rounded-lg shadow-2xl z-50 p-3 space-y-2">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#2a2a3c] transition-colors"
                  >
                    <AppleEmoji emoji={emoji} size={22} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
