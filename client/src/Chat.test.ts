import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Chat from './components/Chat';

describe('Chat input semantics', () => {
  it('marks the field as chat text and disables autofill and spellchecking cues', () => {
    const html = renderToStaticMarkup(
      React.createElement(Chat, { messages: [], placeholder: 'Say hi to the room…' })
    );

    expect(html).toContain('<form autoComplete="off">');
    expect(html).toContain('type="text"');
    expect(html).toContain('name="chat-message"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('autoCapitalize="sentences"');
    expect(html).toContain('autoCorrect="off"');
    expect(html).toContain('spellcheck="false"');
    expect(html).toContain('enterKeyHint="send"');
    expect(html).toContain('aria-label="Chat or guess"');
  });
});
