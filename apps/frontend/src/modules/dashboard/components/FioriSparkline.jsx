import React from 'react';

export default function FioriSparkline({ data = [], color = '#0A6ED1', height = 24, width = 72 }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} className="bg-slate-100 dark:bg-slate-800 rounded opacity-40 shrink-0" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 4) + 2;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });

  const lastPoint = points[points.length - 1].split(',');
  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible shrink-0"
      aria-label={`Trend sparkline: ${data.join(', ')}`}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        r="2"
        fill={color}
      />
    </svg>
  );
}

