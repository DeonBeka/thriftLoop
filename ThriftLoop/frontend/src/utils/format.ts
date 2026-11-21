export function formatPrice(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `€${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/** The backend stores UTC; SQLite drops the offset, so treat bare timestamps as UTC. */
export function parseDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

export function timeAgo(value: string): string {
  const seconds = Math.max(0, (Date.now() - parseDate(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return parseDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function messageTime(value: string): string {
  const date = parseDate(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function joinedDate(value: string): string {
  return parseDate(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
