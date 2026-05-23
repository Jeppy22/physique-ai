'use client';

import { useEffect, useState } from 'react';

const SCRAMBLE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#@*!&%$';

function randomChar(): string {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function scrambleString(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    out += c === ' ' || c === '\n' ? c : randomChar();
  }
  return out;
}

interface ScrambleTextProps {
  text: string;
  duration?: number;
  delay?: number;
}

export function ScrambleText({
  text,
  duration = 400,
  delay = 0,
}: ScrambleTextProps) {
  // SSR-safe: start with the target text so server and first client render match.
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (!text) {
      setDisplay('');
      return;
    }

    let rafId: number | null = null;
    const startTime = performance.now() + delay;

    // Begin scrambling immediately (covers both delay > 0 hold and instant start).
    setDisplay(scrambleString(text));

    const tick = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed < 0) {
        setDisplay(scrambleString(text));
        rafId = requestAnimationFrame(tick);
        return;
      }

      const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
      const lockedCount = Math.floor(progress * text.length);

      let out = '';
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (i < lockedCount) out += c;
        else if (c === ' ' || c === '\n') out += c;
        else out += randomChar();
      }

      setDisplay(out);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [text, duration, delay]);

  return <>{display}</>;
}

export default ScrambleText;
