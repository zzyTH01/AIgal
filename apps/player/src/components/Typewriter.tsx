import { useEffect, useState } from 'react';

export function Typewriter({
  text,
  speed = 30,
  onDone,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState('');
  const done = shown === text;

  useEffect(() => {
    setShown('');
    if (!text) return;
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);

  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

  return <span data-testid="typewriter">{shown}</span>;
}
