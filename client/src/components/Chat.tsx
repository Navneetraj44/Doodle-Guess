import { useEffect, useRef, useState } from 'react';
import { emit } from '../socket';
import { ChatMessage } from '../types';
import Icon from './Icon';

/** Guess + chat panel on ruled notebook paper. The message list scrolls on its own; the input row is always visible underneath it. */
export default function Chat({ messages, placeholder, title = 'Guesses', className = '', empty = 'Guesses and chat show up here.' }: { messages: ChatMessage[]; placeholder: string; title?: string; className?: string; empty?: string }) {
  const [text, setText] = useState(''); const [err, setErr] = useState('');
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [messages]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const t = text.trim(); if (!t) return;
    setText(''); const r = await emit('chat', { text: t }); setErr(r.ok ? '' : r.error);
  };
  return (
    <section className={`chat ${className}`} aria-label={title}>
      <h2 className="chat-head"><Icon name="chat" size={20} /> {title}</h2>
      <div className="msgs" ref={list} role="log" aria-live="polite">
        {messages.length === 0 && <p className="msg system">{empty}</p>}
        {messages.map(m => (
          <p key={m.id} className={`msg ${m.kind} ${m.restricted ? 'restricted' : ''}`}>
            {m.kind === 'chat' && <b>{m.playerName}: </b>}{m.kind === 'correct' && <Icon name="check" size={14} className="msg-icon" />}{m.kind === 'like' && <Icon name="thumbUp" size={14} className="msg-icon" />}{m.kind === 'dislike' && <Icon name="thumbDown" size={14} className="msg-icon" />}{m.kind === 'close' && <Icon name="sparkle" size={14} className="msg-icon" />}{m.text}{m.restricted && <Icon name="lock" size={12} className="msg-icon" label="Only players who know the word see this" />}
          </p>))}
      </div>
      {err && <div className="error small" role="alert">{err}</div>}
      <form autoComplete="off" onSubmit={send}><input type="text" name="chat-message" value={text} maxLength={100} onChange={e => setText(e.target.value)} placeholder={placeholder} aria-label="Chat or guess" autoComplete="off" autoCapitalize="sentences" spellCheck={true} enterKeyHint="send" /><button type="submit" className="send-btn" aria-label="Send"><span className="send-text">Send</span><Icon name="send" size={18} /></button></form>
    </section>
  );
}
