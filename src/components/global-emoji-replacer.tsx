"use client";

import { useEffect } from "react";
import { emojiToCodepoints } from "@/components/apple-emoji";

/**
 * Regex matching emoji characters (single and compound sequences).
 * Covers Emoji_Presentation, Extended_Pictographic, variation selectors,
 * ZWJ sequences, skin tones, keycaps, and flags.
 */
const EMOJI_RE =
  /(?:[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F1E0}-\u{1F1FF}]|[\u{200D}]|[\u{FE0F}]|[\u{20E3}])+/gu;

/** Tags to skip — never replace emojis inside these */
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "NOSCRIPT",
]);

function getAppleUrl(emoji: string): string {
  const code = emojiToCodepoints(emoji);
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.1/img/apple/64/${code}.png`;
}

function shouldSkip(node: Node): boolean {
  let el: Node | null = node;
  while (el) {
    if (el instanceof HTMLElement) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.isContentEditable) return true;
      // Skip nodes already processed
      if (el.dataset?.emojiProcessed) return true;
    }
    el = el.parentNode;
  }
  return false;
}

function replaceEmojisInNode(textNode: Text) {
  const text = textNode.textContent;
  if (!text) return;

  // Quick check — does this text contain any emoji at all?
  EMOJI_RE.lastIndex = 0;
  if (!EMOJI_RE.test(text)) return;

  // Don't process inside inputs, textareas, scripts, etc.
  if (shouldSkip(textNode)) return;

  // Build replacement fragment
  const frag = document.createDocumentFragment();
  let lastIndex = 0;

  EMOJI_RE.lastIndex = 0;
  let match;
  while ((match = EMOJI_RE.exec(text)) !== null) {
    // Text before emoji
    if (match.index > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const emoji = match[0];
    const img = document.createElement("img");
    img.src = getAppleUrl(emoji);
    img.alt = emoji;
    img.width = 16;
    img.height = 16;
    img.draggable = false;
    img.style.cssText = "display:inline-block;vertical-align:text-bottom;width:1em;height:1em;";
    img.dataset.emojiProcessed = "1";
    // Fallback to native emoji on error
    img.onerror = () => {
      const span = document.createElement("span");
      span.textContent = emoji;
      img.replaceWith(span);
    };

    frag.appendChild(img);
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  // Only replace if we actually found emojis (frag has more than 1 child)
  if (frag.childNodes.length > 1 || (frag.childNodes.length === 1 && frag.firstChild !== textNode)) {
    textNode.replaceWith(frag);
  }
}

function walkAndReplace(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // Collect text nodes first (can't modify while walking)
  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    textNodes.push(current as Text);
  }

  for (const tn of textNodes) {
    replaceEmojisInNode(tn);
  }
}

/**
 * Global component that replaces all emoji characters in the DOM
 * with Apple-style emoji images. Uses MutationObserver to catch
 * React re-renders and dynamic content.
 *
 * Mount this once in the root layout.
 */
export function GlobalEmojiReplacer() {
  useEffect(() => {
    // Initial pass
    walkAndReplace(document.body);

    // Watch for DOM changes (React re-renders, dynamic content, etc.)
    let rafId: number | null = null;

    const observer = new MutationObserver(() => {
      // Debounce with rAF to batch multiple mutations
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        walkAndReplace(document.body);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
