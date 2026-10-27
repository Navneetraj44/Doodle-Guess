import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import Icon from './Icon';

/** 28 drawing colours: neutrals, browns/skin, then the rainbow, ending with the five Doodle Den inks. Every value is a plain #rrggbb, exactly what the server validates and the flood fill reads. */
export const PALETTE: { hex: string; name: string }[] = [
  { hex: '#24201b', name: 'Ink' }, { hex: '#5f5a54', name: 'Charcoal' }, { hex: '#9b958c', name: 'Stone' }, { hex: '#d6d0c5', name: 'Fog' }, { hex: '#ffffff', name: 'White' },
  { hex: '#5a3a22', name: 'Dark brown' }, { hex: '#8b5a2b', name: 'Brown' }, { hex: '#c8935a', name: 'Tan' }, { hex: '#f2c9a0', name: 'Skin' },
  { hex: '#e03131', name: 'Red' }, { hex: '#9c1c2b', name: 'Dark red' }, { hex: '#ff4fa3', name: 'Riso pink' }, { hex: '#ff8fc4', name: 'Light pink' },
  { hex: '#f76707', name: 'Orange' }, { hex: '#ff9f43', name: 'Light orange' }, { hex: '#ffd23f', name: 'Sun yellow' }, { hex: '#ffe98a', name: 'Light yellow' },
  { hex: '#a3d63a', name: 'Lime' }, { hex: '#2f9e44', name: 'Green' }, { hex: '#146b3a', name: 'Dark green' }, { hex: '#3ddbb0', name: 'Mint' },
  { hex: '#15aabf', name: 'Teal' }, { hex: '#4db8ff', name: 'Sky' }, { hex: '#1f6fd1', name: 'Riso blue' }, { hex: '#123c8c', name: 'Navy' },
  { hex: '#7048e8', name: 'Violet' }, { hex: '#b197fc', name: 'Lavender' }, { hex: '#9c36b5', name: 'Purple' },
];
export const COLORS = PALETTE.map(c => c.hex);
export const SIZES = [4, 8, 16, 28];
const QUICK_COLORS = PALETTE.filter(c => ['#ffffff', '#24201b', '#8b5a2b', '#e03131', '#ff4fa3', '#f76707', '#ffd23f', '#2f9e44', '#15aabf', '#1f6fd1', '#7048e8'].includes(c.hex));

export type Tool = 'brush' | 'eraser' | 'fill';
interface Props { color: string; size: number; tool: Tool; onColor: (c: string) => void; onSize: (s: number) => void; onTool: (t: Tool) => void; disabled?: boolean; }

/**
 * The compact drawing strip leaves the canvas room; the full palette opens on demand.
 */
export default function DrawToolbar({ color, size, tool, onColor, onSize, onTool, disabled = false }: Props) {
  const eraser = tool === 'eraser', fill = tool === 'fill';
  const [openMenu, setOpenMenu] = useState<'colors' | 'sizes' | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const colorName = (hex: string) => PALETTE.find(c => c.hex === hex)?.name ?? hex;
  const selectColor = (hex: string) => { onColor(hex); if (tool === 'eraser') onTool('brush'); setOpenMenu(null); };
  const selectSize = (next: number) => { onSize(next); setOpenMenu(null); };
  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutside = (event: PointerEvent) => { if (!toolbar.current?.contains(event.target as Node)) setOpenMenu(null); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('pointerdown', closeOnOutside); document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [openMenu]);
  return (
    <div ref={toolbar} className={`toolbar ${disabled ? 'is-disabled' : ''}`} role="toolbar" aria-label="Drawing tools" aria-disabled={disabled || undefined} title={disabled ? 'Drawing tools unlock when the game starts' : undefined}>
      <div className="tb-main">
        <div className="tb-tools" role="group" aria-label="Tools">
          <button type="button" disabled={disabled} className={`tbtn ${tool === 'brush' ? 'on' : ''}`} aria-pressed={tool === 'brush'} aria-label="Pencil" title="Pencil" onClick={() => onTool('brush')}><Icon name="pencil" size={22} /></button>
          <button type="button" disabled={disabled} className={`tbtn ${eraser ? 'on' : ''}`} aria-pressed={eraser} aria-label="Eraser" title="Eraser" onClick={() => onTool(eraser ? 'brush' : 'eraser')}><Icon name="eraser" size={22} /></button>
          <button type="button" disabled={disabled} className={`tbtn ${fill ? 'on' : ''}`} aria-pressed={fill} aria-label="Fill" title="Fill an area with the selected colour" onClick={() => onTool(fill ? 'brush' : 'fill')}><Icon name="bucket" size={22} /></button>
          <button type="button" disabled={disabled} className="tbtn" aria-label="Undo" title="Undo" onClick={() => socket.emit('draw_undo')}><Icon name="undo" size={22} /></button>
          <button type="button" disabled={disabled} className="tbtn" aria-label="Clear canvas" title="Clear canvas" onClick={() => socket.emit('canvas_clear')}><Icon name="trash" size={22} /></button>
        </div>
        <span className="tb-divider" aria-hidden="true" />
        <button type="button" disabled={disabled} className={`current-color ${openMenu === 'colors' ? 'on' : ''}`} aria-label={`Selected color ${colorName(color)}; open colors`} title={`Selected color: ${colorName(color)}`} aria-expanded={openMenu === 'colors'} aria-controls="drawing-palette" style={{ '--current-color': color } as React.CSSProperties} onClick={() => setOpenMenu(menu => menu === 'colors' ? null : 'colors')} />
        <button type="button" disabled={disabled} className="brush-select" aria-label={`Brush size ${size}; open brush sizes`} aria-expanded={openMenu === 'sizes'} aria-controls="brush-size-menu" onClick={() => setOpenMenu(menu => menu === 'sizes' ? null : 'sizes')}><i style={{ width: Math.min(size, 18), height: Math.min(size, 18) }} /><span>{size}</span><Icon name="chevronDown" size={16} /></button>
        <div className="quick-swatches" role="group" aria-label="Frequently used colors">{QUICK_COLORS.map(c => { const on = tool !== 'eraser' && color === c.hex; return <button key={c.hex} type="button" disabled={disabled} aria-label={`Color ${c.name}`} title={c.name} aria-pressed={on} className={`swatch ${on ? 'on' : ''} ${c.hex === '#ffffff' ? 'white' : ''}`} style={{ background: c.hex }} onClick={() => selectColor(c.hex)} />; })}</div>
      </div>
      {openMenu === 'colors' && !disabled && <div id="drawing-palette" className="drawing-palette" role="dialog" aria-label="Colors">
        <div className="palette-head"><strong>Colors</strong><button type="button" className="palette-close" onClick={() => setOpenMenu(null)} aria-label="Close colors"><Icon name="x" size={20} /></button></div>
        <div className="palette-grid" role="group" aria-label="All colors">{PALETTE.map(c => { const on = tool !== 'eraser' && color === c.hex; return <button key={c.hex} type="button" aria-label={`Color ${c.name}`} title={c.name} aria-pressed={on} className={`swatch ${on ? 'on' : ''} ${c.hex === '#ffffff' ? 'white' : ''}`} style={{ background: c.hex }} onClick={() => selectColor(c.hex)} />; })}</div>
      </div>}
      {openMenu === 'sizes' && !disabled && <div id="brush-size-menu" className="brush-size-menu" role="dialog" aria-label="Brush sizes">
        <div className="size-menu-head"><strong>Brush size</strong><button type="button" className="palette-close" onClick={() => setOpenMenu(null)} aria-label="Close brush sizes"><Icon name="x" size={20} /></button></div>
        <div className="palette-sizes" role="group" aria-label="Brush sizes">{SIZES.map(s => <button key={s} type="button" aria-label={`Brush size ${s}`} aria-pressed={size === s} className={`size ${size === s ? 'on' : ''}`} onClick={() => selectSize(s)}><i style={{ width: Math.min(s, 20), height: Math.min(s, 20) }} /></button>)}</div>
      </div>}
      {!disabled && <span className="sr-only" role="status">{eraser ? 'Eraser selected' : `${colorName(color)} selected`}</span>}
    </div>
  );
}
