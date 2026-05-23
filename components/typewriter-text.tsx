'use client';

import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  text: string;
  animate: boolean;
  charDelayMs?: number;
  cursor?: boolean;
}

export function TypewriterText({
  text,
  animate,
  charDelayMs = 50,
  cursor = true,
}: TypewriterTextProps) {
  // Initial state honours the animate flag so there's no "full → empty → typing" flash
  // when the component mounts already configured to animate.
  const [count, setCount] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(interval);
    }, charDelayMs);
    return () => clearInterval(interval);
  }, [text, animate, charDelayMs]);

  const visible = text.slice(0, count);
  const done = count >= text.length;

  return (
    <>
      {visible}
      {cursor && !done && (
        <span className="terminal-blink ml-0.5 text-terminal-amber">●</span>
      )}
    </>
  );
}

export default TypewriterText;
