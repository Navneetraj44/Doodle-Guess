import { ReactNode } from 'react';
import { AvatarSpec, parseAvatar } from '../lib';

/** Original cartoon faces in the spirit of skribbl.io: a round coloured head on little shoulders, with 10 pairs of eyes and 10 mouths to mix. */
const COLORS = ['#ff6b6b', '#ff9f43', '#ffd93d', '#a3e635', '#2ed573', '#1dd1a1', '#48dbfb', '#54a0ff', '#8c7bff', '#c06bff', '#ff7eb6', '#c9955f'];
const INK = '#24201B';
const S = { stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

const EYES: ReactNode[] = [
  /* 0 dots */ <g key="e0" fill={INK}><circle cx="24" cy="27" r="2.8" /><circle cx="40" cy="27" r="2.8" /></g>,
  /* 1 googly */ <g key="e1"><circle cx="24" cy="26" r="6" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="40" cy="26" r="6" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="25.5" cy="27.5" r="2.4" fill={INK} /><circle cx="38.5" cy="27.5" r="2.4" fill={INK} /></g>,
  /* 2 happy arcs */ <g key="e2" {...S}><path d="M19.5 29 Q24 22 28.5 29" /><path d="M35.5 29 Q40 22 44.5 29" /></g>,
  /* 3 angry */ <g key="e3"><g fill={INK}><circle cx="24" cy="28" r="2.6" /><circle cx="40" cy="28" r="2.6" /></g><g {...S}><path d="M18.5 21 L28.5 25" /><path d="M45.5 21 L35.5 25" /></g></g>,
  /* 4 sleepy */ <g key="e4" {...S}><path d="M19.5 28 H28.5" /><path d="M35.5 28 H44.5" /></g>,
  /* 5 cyclops */ <g key="e5"><circle cx="32" cy="26" r="8" fill="#fff" stroke={INK} strokeWidth="2.2" /><circle cx="32" cy="26" r="3.4" fill={INK} /></g>,
  /* 6 x eyes */ <g key="e6" {...S}><path d="M20.5 23.5 L27.5 30.5 M27.5 23.5 L20.5 30.5" /><path d="M36.5 23.5 L43.5 30.5 M43.5 23.5 L36.5 30.5" /></g>,
  /* 7 tiny wide-set */ <g key="e7" fill={INK}><circle cx="19" cy="26" r="2.1" /><circle cx="45" cy="26" r="2.1" /></g>,
  /* 8 surprised */ <g key="e8"><circle cx="24" cy="26" r="6.5" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="40" cy="26" r="6.5" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="24" cy="26" r="1.8" fill={INK} /><circle cx="40" cy="26" r="1.8" fill={INK} /></g>,
  /* 9 wink */ <g key="e9"><circle cx="24" cy="27" r="2.8" fill={INK} /><g {...S}><path d="M35.5 29 Q40 22 44.5 29" /></g></g>,
];
const MOUTHS: ReactNode[] = [
  /* 0 smile */ <path key="m0" {...S} d="M24 37 Q32 46 40 37" />,
  /* 1 flat */ <path key="m1" {...S} d="M26 41 H38" />,
  /* 2 open O */ <ellipse key="m2" cx="32" cy="41" rx="4.2" ry="5.2" fill={INK} />,
  /* 3 big grin */ <path key="m3" d="M22 36 Q32 52 42 36 Z" fill="#fff" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />,
  /* 4 frown */ <path key="m4" {...S} d="M25 43 Q32 36 39 43" />,
  /* 5 tongue */ <g key="m5"><path d="M30 40 v5 a2.6 2.6 0 0 0 5.2 0 v-4 z" fill="#ff7aa0" stroke={INK} strokeWidth="2" strokeLinejoin="round" /><path {...S} d="M24 37 Q32 45 40 37" /></g>,
  /* 6 zigzag */ <path key="m6" {...S} d="M23 41 L27 37.5 L31 41.5 L35 37.5 L39 41" />,
  /* 7 small smile */ <path key="m7" {...S} d="M28 39 Q32 42.5 36 39" />,
  /* 8 teeth */ <g key="m8"><rect x="25" y="36" width="14" height="9" rx="2.5" fill="#fff" stroke={INK} strokeWidth="2.4" /><path {...S} strokeWidth="1.8" d="M32 36 V45 M25 40.5 H39" /></g>,
  /* 9 smirk */ <path key="m9" {...S} d="M26 41 Q34 43.5 40 36.5" />,
];

type Size = 'sm' | 'md' | 'xl' | 'fill';
/** Draws the face for an avatar code. An unknown code (for example an old emoji from an earlier session) shows a neutral face instead of crashing. */
export default function Avatar({ code, size = 'md', className = '' }: { code: string | null | undefined; size?: Size; className?: string }) {
  const a: AvatarSpec = parseAvatar(code) ?? { color: 7, eyes: 0, mouth: 7 };
  const color = COLORS[a.color];
  return (
    <span className={`avatar ${size} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" focusable="false">
        <path d="M9 64 C9 51 19 46.5 32 46.5 C45 46.5 55 51 55 64 Z" fill={color} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M9 64 C9 51 19 46.5 32 46.5 C45 46.5 55 51 55 64 Z" fill="#000" opacity=".16" />
        <ellipse cx="32" cy="30" rx="21" ry="20" fill={color} stroke={INK} strokeWidth="2.6" />
        <path d="M15.5 22 Q19 12.5 28 10.5" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
        {EYES[a.eyes]}{MOUTHS[a.mouth]}
      </svg>
    </span>
  );
}
