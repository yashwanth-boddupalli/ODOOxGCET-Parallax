// Display helpers shared by pages and charts.

export const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// 1234.5 -> "1,234.5"; 12.000 -> "12"
export const formatQty = (value) =>
  toNumber(value).toLocaleString('en-US', { maximumFractionDigits: 3 });

export const formatSignedQty = (value) => {
  const n = toNumber(value);
  return n > 0 ? `+${formatQty(n)}` : formatQty(n);
};

export const formatMoney = (value, fractionDigits = 2) =>
  `$${toNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;

// 14820 -> "14.8k", used for tight spots like sidebar badges.
export const formatCompact = (value) => {
  const n = toNumber(value);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
};

export const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

export const todayIso = () => new Date().toISOString().slice(0, 10);
