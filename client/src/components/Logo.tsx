import Icon from './Icon';
/** Doodle Guess wordmark: marker lettering printed in ink with a pink riso misregistration, a highlighter swipe under "Guess" and a pencil. Original artwork. */
export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`logo ${small ? 'small' : ''}`} aria-label="Doodle Guess">
      <span className="logo-word" aria-hidden="true"><span className="w1">Doodle</span> <span className="w2">Guess</span></span>
      <span className="logo-pencil" aria-hidden="true"><Icon name="pencil" size={small ? 22 : 46} /></span>
      {!small && <svg className="logo-squiggle" viewBox="0 0 300 16" aria-hidden="true"><path d="M4 9c18-10 30 8 48 0s30 8 48 0 30 8 48 0 30 8 48 0 30 8 48 0 30 8 48 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>}
    </h1>
  );
}
