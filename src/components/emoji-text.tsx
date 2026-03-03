"use client";

import { getAppleEmojiUrl } from "@/components/apple-emoji";

/**
 * Regex that matches most emoji characters (including compound emojis).
 * Covers: Emoji_Presentation, Extended_Pictographic, skin tones, ZWJ sequences, flags
 */
const EMOJI_RE =
  /([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}])+/gu;

interface EmojiTextProps {
  text: string;
  emojiSize?: number;
  className?: string;
}

/**
 * Renders a string with emoji characters replaced by Apple-style emoji images.
 * Non-emoji text is rendered as-is.
 */
export function EmojiText({ text, emojiSize = 16, className = "" }: EmojiTextProps) {
  const parts: (string | { emoji: string; key: number })[] = [];
  let lastIndex = 0;
  let key = 0;

  // Reset regex state
  EMOJI_RE.lastIndex = 0;

  let match;
  while ((match = EMOJI_RE.exec(text)) !== null) {
    // Add text before the emoji
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ emoji: match[0], key: key++ });
    lastIndex = match.index + match[0].length;
  }
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no emojis found, just return the text
  if (parts.length === 1 && typeof parts[0] === "string") {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part) => {
        if (typeof part === "string") {
          return part;
        }
        return (
          <img
            key={part.key}
            src={getAppleEmojiUrl(part.emoji)}
            alt={part.emoji}
            width={emojiSize}
            height={emojiSize}
            className="inline-block align-text-bottom"
            style={{ width: emojiSize, height: emojiSize }}
            draggable={false}
            onError={(e) => {
              // Fallback: show native emoji
              const span = document.createElement("span");
              span.textContent = part.emoji;
              (e.target as HTMLElement).replaceWith(span);
            }}
          />
        );
      })}
    </span>
  );
}
