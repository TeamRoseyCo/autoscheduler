"use client";

/**
 * Renders an emoji character as an Apple-style emoji image via CDN.
 * Falls back to the native emoji character if the image fails to load.
 */

function emojiToCodepoints(emoji: string): string {
  const codepoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xfe0f) {
      // Skip variation selector U+FE0F
      codepoints.push(cp.toString(16));
    }
  }
  return codepoints.join("-");
}

function getAppleEmojiUrl(emoji: string): string {
  const code = emojiToCodepoints(emoji);
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.1/img/apple/64/${code}.png`;
}

interface AppleEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
}

export function AppleEmoji({ emoji, size = 20, className = "" }: AppleEmojiProps) {
  return (
    <img
      src={getAppleEmojiUrl(emoji)}
      alt={emoji}
      width={size}
      height={size}
      className={`inline-block align-text-bottom ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
      onError={(e) => {
        // Fallback: replace with native emoji text
        const span = document.createElement("span");
        span.textContent = emoji;
        span.style.fontSize = `${size}px`;
        span.style.lineHeight = "1";
        (e.target as HTMLElement).replaceWith(span);
      }}
    />
  );
}

export { getAppleEmojiUrl, emojiToCodepoints };
