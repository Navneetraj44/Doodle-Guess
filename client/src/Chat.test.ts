import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Chat from './components/Chat';

describe('Chat input semantics', () => {
  it('marks the message field as chat text and disables browser autofill suggestions', () => {
    const html = renderToStaticMarkup(
      React.createElement(Chat, { messages: [], placeholder: 'Say hi to the room…' })
    );

    expect(html).toContain('<form autoComplete="off">');
    expect(html).toContain('type="text"');
    expect(html).toContain('name="chat-message"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('autoCapitalize="sentences"');
    expect(html).toContain('spellcheck="true"');
    expect(html).toContain('enterKeyHint="send"');
    expect(html).toContain('aria-label="Chat or guess"');
  });
});
