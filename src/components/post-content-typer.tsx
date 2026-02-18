'use client';

import { useEffect, useState } from 'react';

interface Props {
  postId: string;
  content: string;
}

export function PostContentTyper({ postId, content }: Props) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const key = `typed_${postId}`;

    // Already visited — show instantly
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) {
      setDisplayed(content);
      setDone(true);
      return;
    }

    // Type out the content character-by-character
    let i = 0;
    const CHARS_PER_TICK = 4; // batch for speed
    const INTERVAL_MS = 14;

    const timer = setInterval(() => {
      if (i >= content.length) {
        clearInterval(timer);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(key, '1');
        }
        setDone(true);
        return;
      }
      i = Math.min(i + CHARS_PER_TICK, content.length);
      setDisplayed(content.slice(0, i));
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [postId, content]);

  return (
    <div
      suppressHydrationWarning
      className="mt-6 font-mono text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap"
    >
      {displayed}
      {!done && (
        <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-cursor-blink" />
      )}
    </div>
  );
}
