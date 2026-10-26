/** "Scribs", the Doodle Guess mascot: a round doodle-cat hugging a giant pencil over a notebook. Original artwork. */
export default function Mascot({ className = '' }: { className?: string }) {
  return (
    <svg className={`mascot ${className}`} viewBox="0 0 320 280" role="img" aria-label="Doodle Guess mascot: a cat with a giant pencil">
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" stroke="#24201B">
        <g transform="rotate(-8 140 220)"><rect x="40" y="150" width="210" height="110" rx="12" fill="#fffdf8" />
          {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={58 + i * 26} cy="150" r="7" fill="#1F6FD1" />)}
          <path d="M62 190h170M62 214h170M62 238h120" stroke="#9CC2F0" strokeWidth="4" fill="none" />
          <path d="M70 176c20-16 38 10 58-6s34 4 52-6" stroke="#FF4FA3" strokeWidth="5" fill="none" /></g>
        <path d="M82 92L74 40l40 26z M198 92l8-52-40 26z" fill="#fffdf8" />
        <path d="M86 78L82 54l20 12z M194 78l4-24-20 12z" fill="#FFB3D6" strokeWidth="0" />
        <ellipse cx="140" cy="112" rx="72" ry="62" fill="#fffdf8" />
        <ellipse cx="116" cy="108" rx="7" ry="10" fill="#24201B" /><ellipse cx="164" cy="108" rx="7" ry="10" fill="#24201B" />
        <circle cx="119" cy="104" r="2.500" fill="#fff" strokeWidth="0" /><circle cx="167" cy="104" r="2.500" fill="#fff" strokeWidth="0" />
        <path d="M134 126q6 6 12 0" fill="none" /><path d="M140 122v4" fill="none" />
        <ellipse cx="98" cy="128" rx="10" ry="6" fill="#FFB3D6" strokeWidth="0" /><ellipse cx="182" cy="128" rx="10" ry="6" fill="#FFB3D6" strokeWidth="0" />
        <path d="M70 118l-26-4M70 128l-26 6M210 118l26-4M210 128l26 6" fill="none" strokeWidth="4" />
        <g transform="rotate(32 236 140)"><rect x="216" y="30" width="34" height="150" rx="5" fill="#FFD23F" /><path d="M216 30h34v22h-34z" fill="#FF4FA3" /><path d="M216 180l17 34 17-34z" fill="#f2d9a0" /><path d="M226 200l7 14 7-14z" fill="#24201B" strokeWidth="2" /><path d="M233 52v128" stroke="#e8a500" strokeWidth="4" fill="none" /></g>
      </g>
      <g fill="#FFD23F" stroke="#24201B" strokeWidth="3" strokeLinejoin="round"><path d="M270 40l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" /><path d="M24 70l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /></g>
      <g fill="#FF4FA3" stroke="#24201B" strokeWidth="3"><circle cx="292" cy="150" r="7" /></g>
    </svg>
  );
}
