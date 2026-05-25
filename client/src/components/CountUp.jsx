import { useState, useEffect } from 'react';

export default function CountUp({ value, duration = 1000, className = '', formatter }) {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
  const isNumeric = typeof value === 'number' || /^[\d.$%,]+$/.test(String(value).replace(/,/g, ''));

  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isNumeric) return;
    const startTime = performance.now();
    const step = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setDisplay(Math.floor(num * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [num, duration, isNumeric]);

  if (!isNumeric) {
    return <span className={className}>{value}</span>;
  }

  const shown = formatter ? formatter(display) : display;
  return <span className={`font-mono tabular-nums ${className}`}>{shown}</span>;
}
