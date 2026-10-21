import { toCanvas, toSvg } from 'html-to-image';
import { getViewportForBounds } from '@xyflow/react';

export type DiagramTheme = 'light' | 'dark';
export type DiagramFormat = 'png' | 'svg';

type Bounds = { x: number; y: number; width: number; height: number };
type Palette = {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  gold: string;
  blue: string;
  line: string;
  gray: string;
};

const palette: Record<DiagramTheme, Palette> = {
  dark: {
    bg: '#101624',
    card: '#192238',
    border: '#31435f',
    text: '#d5e2f4',
    muted: '#8ea0bd',
    gold: '#f5c84e',
    blue: '#67b9ff',
    line: '#4c9ddd',
    gray: '#8b98ad',
  },
  light: {
    bg: '#f4f7fc',
    card: '#ffffff',
    border: '#d5e0ef',
    text: '#1a293d',
    muted: '#5d7090',
    gold: '#c99212',
    blue: '#1670c0',
    line: '#2f86d6',
    gray: '#7d8da3',
  },
};

const rows: Array<{ kind: 'gold' | 'blue' | 'line' | 'gray'; label: string }> = [
  { kind: 'gold', label: 'Primary key  [PK]' },
  { kind: 'blue', label: 'Foreign key  [FK]' },
  { kind: 'line', label: 'PK to FK' },
  { kind: 'gray', label: 'Optional field  ?' },
];

export async function captureDiagram(input: {
  viewport: HTMLElement;
  bounds: Bounds;
  theme: DiagramTheme;
  format: DiagramFormat;
}): Promise<Blob> {
  const { viewport, bounds, theme, format } = input;
  if (bounds.width < 8 || bounds.height < 8) {
    throw new Error('The diagram is still measuring. Try again in a moment.');
  }
  const margin = 110;
  const frame = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
  };
  const width = Math.ceil(frame.width);
  const height = Math.ceil(frame.height);
  const fitted = getViewportForBounds(frame, width, height, 0.05, 1, 0);
  const colors = palette[theme];
  const pixelRatio = width * height > 5_000_000 ? 1 : 2;
  const style: Partial<CSSStyleDeclaration> = {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${fitted.x}px, ${fitted.y}px) scale(${fitted.zoom})`,
    transformOrigin: '0 0',
    overflow: 'visible',
    background: colors.bg,
  };
  const shared = {
    backgroundColor: colors.bg,
    width,
    height,
    cacheBust: true,
    style,
    pixelRatio,
  };
  if (format === 'svg') {
    const dataUrl = await toSvg(viewport, shared);
    const xml = widenSvg(decodeSvg(dataUrl), theme);
    return new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  }
  const diagram = await toCanvas(viewport, shared);
  return composePng(diagram, theme, width);
}

export function saveDiagramFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function composePng(diagram: HTMLCanvasElement, theme: DiagramTheme, cssWidth: number) {
  const scale = diagram.width / cssWidth || 1;
  const colors = palette[theme];
  const legendW = 232 * scale;
  const gap = 28 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(diagram.width + gap + legendW);
  canvas.height = Math.max(diagram.height, Math.round(230 * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(diagram, 0, 0);
  drawLegend(ctx, diagram.width + gap, 32 * scale, scale, colors);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode PNG'))), 'image/png');
  });
}

function drawLegend(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, colors: Palette) {
  const w = 220 * scale;
  const h = 176 * scale;
  const radius = 12 * scale;
  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = Math.max(1, scale);
  ctx.stroke();
  ctx.fillStyle = colors.muted;
  ctx.font = `700 ${11 * scale}px Inter, Segoe UI, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('DIAGRAM LEGEND', x + 18 * scale, y + 28 * scale);
  rows.forEach((row, index) => {
    const ry = y + (58 + index * 32) * scale;
    const cx = x + 30 * scale;
    if (row.kind === 'line') {
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2.4 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 12 * scale, ry - 4 * scale);
      ctx.lineTo(cx + 12 * scale, ry - 4 * scale);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.fillStyle = row.kind === 'gold' ? colors.gold : row.kind === 'blue' ? colors.blue : colors.gray;
      ctx.arc(cx, ry - 4 * scale, 5.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = colors.text;
    ctx.font = `${13 * scale}px Inter, Segoe UI, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, x + 54 * scale, ry - 4 * scale);
  });
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function decodeSvg(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  const head = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (head.includes(';base64')) {
    const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(body);
}

function widenSvg(xml: string, theme: DiagramTheme) {
  const width = Number(xml.match(/\bwidth="([\d.]+)"/)?.[1] || 0);
  const height = Number(xml.match(/\bheight="([\d.]+)"/)?.[1] || 0);
  const colors = palette[theme];
  const legendW = 248;
  const gap = 36;
  const nextW = width + gap + legendW;
  const nextH = Math.max(height, 240);
  let next = xml.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const cleaned = attrs.replace(/\s(?:width|height|viewBox)="[^"]*"/g, '');
    return `<svg${cleaned} width="${nextW}" height="${nextH}" viewBox="0 0 ${nextW} ${nextH}">`;
  });
  next = next.replace(/<foreignObject\b[^>]*>/, `<foreignObject width="${width}" height="${height}" x="0" y="0">`);
  const openEnd = next.indexOf('>') + 1;
  next = `${next.slice(0, openEnd)}<rect width="${nextW}" height="${nextH}" fill="${colors.bg}"/>${next.slice(openEnd)}`;
  return next.replace('</svg>', `${legendSvg(width + gap, 36, colors)}</svg>`);
}

function legendSvg(x: number, y: number, colors: Palette) {
  const marks = rows.map((row, index) => {
    const ry = y + 58 + index * 32;
    const mark = row.kind === 'line'
      ? `<line x1="${x + 18}" y1="${ry - 4}" x2="${x + 42}" y2="${ry - 4}" stroke="${colors.line}" stroke-width="2.5" stroke-linecap="round"/>`
      : `<circle cx="${x + 30}" cy="${ry - 4}" r="5.5" fill="${row.kind === 'gold' ? colors.gold : row.kind === 'blue' ? colors.blue : colors.gray}"/>`;
    return `${mark}<text x="${x + 54}" y="${ry}" fill="${colors.text}" font-family="Inter, Segoe UI, sans-serif" font-size="13">${row.label}</text>`;
  }).join('');
  return `<g><rect x="${x}" y="${y}" width="220" height="176" rx="12" fill="${colors.card}" stroke="${colors.border}"/><text x="${x + 18}" y="${y + 28}" fill="${colors.muted}" font-family="Inter, Segoe UI, sans-serif" font-size="11" font-weight="700" letter-spacing="0.08em">DIAGRAM LEGEND</text>${marks}</g>`;
}
