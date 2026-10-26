import { useEffect, useState } from 'react';
import { msToNextTick, secondsLeft } from '../clock';
import Icon from './Icon';

/**
 * The round countdown, drawn as a rubber stamp with a clock icon. It never counts on its own: every render recomputes the seconds from the
 * SERVER's deadline (`endsAt`) and the measured clock offset, and the next update is scheduled for the next whole-second boundary. So it cannot
 * drift, it catches up after a throttled background tab, and every player sees the same number.
 */
export default function Timer({ endsAt, offset }: { endsAt: number | null; offset: number }) {
  const calc = () => secondsLeft(endsAt, Date.now(), offset);
  const [s, setS] = useState(calc);
  useEffect(() => {
    let handle: ReturnType<typeof setTimeout>; let stopped = false;
    const tick = () => {
      if (stopped) return; setS(calc());
      if (endsAt !== null && msToNextTick(endsAt, Date.now(), offset) > 0) handle = setTimeout(tick, msToNextTick(endsAt, Date.now(), offset));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') { clearTimeout(handle); tick(); } }; // a hidden tab may have been throttled: catch up at once
    document.addEventListener('visibilitychange', onVisible); tick();
    return () => { stopped = true; clearTimeout(handle); document.removeEventListener('visibilitychange', onVisible); };
  }, [endsAt, offset]);
  const low = s !== null && s <= 10;
  return (
    <div className={`timer ${low ? 'low' : ''}`} role="timer" aria-label={s === null ? 'No timer' : `${s} seconds left`}>
      <Icon name="clock" size={22} className="timer-icon" /><span className="timer-num">{s === null ? '–' : s}</span>
    </div>
  );
}
