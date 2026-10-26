import { ReactNode } from 'react';

/** One cohesive icon family (24px grid, rounded 2.2px marker-style strokes) used everywhere instead of emoji. Player avatars are drawn separately (Avatar.tsx). */
const P: Record<string, ReactNode> = {
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />,
  thumbUp: <><path d="M7 11v9H4v-9h3z" /><path d="M7 11l4-7c1.6 0 2.6 1.1 2.1 3L12.4 10H19a2 2 0 011.9 2.6l-1.6 6A2 2 0 0117.4 20H7" /></>,
  thumbDown: <g transform="rotate(180 12 12)"><path d="M7 11v9H4v-9h3z" /><path d="M7 11l4-7c1.6 0 2.6 1.1 2.1 3L12.4 10H19a2 2 0 011.9 2.6l-1.6 6A2 2 0 0117.4 20H7" /></g>,
  eraser: <><path d="M4 15.5l8.5-9.2a2 2 0 013 0l4 4a2 2 0 010 2.8L14 18H8.5L4 15.5z" /><path d="M9 11l5 5M10 21h10" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></>,
  link: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>,
  lock: <><rect x="5.5" y="11" width="13" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18" /></>,
  door: <><path d="M10 4H5v16h5" /><path d="M15 8l4 4-4 4M19 12H9" /></>,
  pencil: <><path d="M4 20l1-5L16 4l4 4L9 19l-5 1z" /><path d="M14 6l4 4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  trophy: <><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8M10 17h4" /></>,
  refresh: <><path d="M20 11a8 8 0 10-2.2 6" /><path d="M20 5v6h-6" /></>,
  play: <path d="M7 4.5l12 7.5-12 7.5V4.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 015 5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  frame: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M6.5 14l3.5-4 3 3 2-2 3 3M8 21h8M12 17v4" /></>,
  paw: <><circle cx="6" cy="10" r="1.7" /><circle cx="10" cy="6" r="1.7" /><circle cx="14" cy="6" r="1.7" /><circle cx="18" cy="10" r="1.7" /><path d="M12 12c-3 0-5 3-5 5a2 2 0 002.5 2c1-.3 1.5-.6 2.5-.6s1.5.3 2.5.6A2 2 0 0017 17c0-2-2-5-5-5z" /></>,
  slice: <><path d="M3 6c6-3 12-3 18 0L12 21 3 6z" /><path d="M9 10h.01M14 9h.01M12 14h.01" /></>,
  bulb: <><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 11c.7.6 1 1.2 1 2h5c0-.8.3-1.4 1-2A6 6 0 0012 3z" /></>,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  leaf: <><path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" /><path d="M5 19l8-8" /></>,
  wheel: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 4v6M12 14v6M4 12h6M14 12h6" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="M12 8l3 2-1 4h-4l-1-4 3-2zM12 3v5M15 10l5-1M14 14l3 5M10 14l-3 5M9 10L4 9" /></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  chip: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></>,
  lotus: <><path d="M12 20c-4 0-7-3-8-7 3 0 5 1 8 4 3-3 5-4 8-4-1 4-4 7-8 7z" /><path d="M12 17C9 14 9 9 12 4c3 5 3 10 0 13z" /></>,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />,
  star: <path d="M12 3l2.7 5.5 6 .9-4.4 4.2 1 6L12 16.8 6.7 19.6l1-6L3.3 9.4l6-.9L12 3z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  send: <><path d="M4 12l16-8-6 16-3-7-7-1z" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  bucket: <><path d="M5 11l7-7 7 7-7 7-7-7z" /><path d="M5 11h14M19.5 15c1 1.4 1.5 2.4 1.5 3.2a1.5 1.5 0 01-3 0c0-.8.5-1.8 1.5-3.2z" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h12l-2.5 4L17 12H5" /></>,
  chat: <><path d="M4 5h16v11H11l-5 4v-4H4V5z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" /></>,
  wifiOff: <><path d="M3 3l18 18M5 10a10 10 0 015-2.7M19 10a10 10 0 00-3-2M8.5 14a5 5 0 014-1.3M12 18h.01" /></>,
};
export type IconName = keyof typeof P;
export default function Icon({ name, size = 20, className = '', label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">{P[name]}</svg>
  );
}
