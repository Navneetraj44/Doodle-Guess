import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConfirmDialog from './components/ConfirmDialog';
import Landing from './components/Landing';
import { removalMessage, REMOVAL_NOTICE_MS } from './removal';

describe('moderation confirmation UI', () => {
  it('renders the accessible custom Kick and Ban dialog content', () => {
    const kick = renderToStaticMarkup(React.createElement(ConfirmDialog, { title: 'Kick player?', confirmLabel: 'Kick player', onConfirm: vi.fn(), onCancel: vi.fn(), children: React.createElement('p', null, 'Ava will be returned to the home page.') }));
    const ban = renderToStaticMarkup(React.createElement(ConfirmDialog, { title: 'Ban player?', confirmLabel: 'Ban player', onConfirm: vi.fn(), onCancel: vi.fn(), children: React.createElement('p', null, 'Ava cannot rejoin this room from the same browser session.') }));
    expect(kick).toContain('role="alertdialog"'); expect(kick).toContain('Kick player?'); expect(kick).toContain('Kick player');
    expect(ban).toContain('Ban player?'); expect(ban).toContain('same browser session');
  });

  it('renders a compact moderation dialog without a body when no extra content is supplied', () => {
    const html = renderToStaticMarkup(React.createElement(ConfirmDialog, { title: 'Kick Raj?', confirmLabel: 'Confirm', dialogClass: 'moderation-dialog is-kick', closeLabel: 'Close confirmation', onConfirm: vi.fn(), onCancel: vi.fn() }));
    expect(html).toContain('Kick Raj?'); expect(html).toContain('Close confirmation'); expect(html).not.toContain('confirm-body');
  });
});

describe('removed-player notice lifecycle', () => {
  it('uses concise action-specific copy and renders a dismiss control', () => {
    expect(removalMessage(false)).toBe('You were removed from the room.'); expect(removalMessage(true)).toBe('You are banned from this room.'); expect(REMOVAL_NOTICE_MS).toBe(8000);
    vi.stubGlobal('location', { search: '', origin: 'http://localhost:5173', pathname: '/' });
    const html = renderToStaticMarkup(React.createElement(Landing, { initialName: 'Ava', initialAvatar: '0-0-0', connected: true, notice: removalMessage(false), onDismissNotice: vi.fn(), onEnter: vi.fn() }));
    expect(html).toContain('landing-notice'); expect(html).toContain('Dismiss notification');
  });
});
