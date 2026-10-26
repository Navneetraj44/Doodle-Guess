import { ReactNode } from 'react';
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

export type Tool = 'brush' | 'eraser' | 'fill';
interface Props { color: string; size: number; tool: Tool; onColor: (c: string) => void; onSize: (s: number) => void; onTool: (t: Tool) => void; reactions?: ReactNode; disabled?: boolean; }

/**
 * The drawing toolbar under the board. Used by the game screen (live) and by the waiting lobby (`disabled`: a visible but inert preview,
 * so nothing can be sent to a canvas that does not exist yet).
 */
export default function DrawToolbar({ color, size, tool, onColor, onSize, onTool, reactions, disabled = false }: Props) {
  const eraser = tool === 'eraser', fill = tool === 'fill';
  const colorName = (hex: string) => PALETTE.find(c => c.hex === hex)?.name ?? hex;
  return (
    <div className={`toolbar ${disabled ? 'is-disabled' : ''}`} role="toolbar" aria-label="Drawing tools" aria-disabled={disabled || undefined} title={disabled ? 'Drawing tools unlock when the game starts' : undefined}>
      <div className="tb-left">
        <div className="tb-row" role="group" aria-label="Tools">
          <button type="button" disabled={disabled} className={`tbtn ${tool === 'brush' ? 'on' : ''}`} aria-pressed={tool === 'brush'} aria-label="Pencil" title="Pencil" onClick={() => onTool('brush')}><Icon name="pencil" size={22} /></button>
          <button type="button" disabled={disabled} className={`tbtn ${eraser ? 'on' : ''}`} aria-pressed={eraser} aria-label="Eraser" title="Eraser" onClick={() => onTool(eraser ? 'brush' : 'eraser')}><Icon name="eraser" size={22} /></button>
          <button type="button" disabled={disabled} className={`tbtn ${fill ? 'on' : ''}`} aria-pressed={fill} aria-label="Fill" title="Fill an area with the selected colour" onClick={() => onTool(fill ? 'brush' : 'fill')}><Icon name="bucket" size={22} /></button>
          <button type="button" disabled={disabled} className="tbtn" aria-label="Undo" title="Undo" onClick={() => socket.emit('draw_undo')}><Icon name="undo" size={22} /></button>
          <button type="button" disabled={disabled} className="tbtn" aria-label="Clear canvas" title="Clear canvas" onClick={() => socket.emit('canvas_clear')}><Icon name="trash" size={22} /></button>
        </div>
        <div className="tb-row sizes" role="group" aria-label="Brush sizes">{SIZES.map(s => <button key={s} type="button" disabled={disabled} aria-label={`Brush size ${s}`} title={`Brush size ${s}`} aria-pressed={size === s} className={`size ${size === s ? 'on' : ''}`} onClick={() => onSize(s)}><i style={{ width: Math.min(s, 20), height: Math.min(s, 20) }} /></button>)}</div>
      </div>
      <div className="palette" role="group" aria-label="Colors">{PALETTE.map(c => { const on = tool !== 'eraser' && color === c.hex; return <button key={c.hex} type="button" disabled={disabled} aria-label={`Color ${c.name}`} title={c.name} aria-pressed={on} className={`swatch ${on ? 'on' : ''} ${c.hex === '#ffffff' ? 'white' : ''}`} style={{ background: c.hex }} onClick={() => { onColor(c.hex); if (tool === 'eraser') onTool('brush'); }} />; })}</div>
      {reactions && <div className="tb-react">{reactions}</div>}
      {!disabled && <span className="sr-only" role="status">{eraser ? 'Eraser selected' : `${colorName(color)} selected`}</span>}
    </div>
  );
}
