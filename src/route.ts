export type Box = {id: string; x: number; y: number; w: number; h: number};

function hits(box: Box, x1: number, y1: number, x2: number, y2: number, pad = 7) {
  const left = box.x - pad;
  const right = box.x + box.w + pad;
  const top = box.y - pad;
  const bottom = box.y + box.h + pad;
  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1;
    if (y <= top || y >= bottom) return false;
    return Math.max(x1, x2) > left && Math.min(x1, x2) < right;
  }
  if (Math.abs(x1 - x2) < 0.5) {
    const x = x1;
    if (x <= left || x >= right) return false;
    return Math.max(y1, y2) > top && Math.min(y1, y2) < bottom;
  }
  return false;
}

function blocked(boxes: Box[], x1: number, y1: number, x2: number, y2: number) {
  return boxes.some(box => hits(box, x1, y1, x2, y2));
}

function dedupe(points: Array<[number, number]>) {
  const out: Array<[number, number]> = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev[0] - point[0]) > 0.5 || Math.abs(prev[1] - point[1]) > 0.5) out.push(point);
  }
  return out;
}

function ortho(points: Array<[number, number]>, radius = 7) {
  const clean = dedupe(points);
  if (clean.length < 2) return '';
  let d = `M ${clean[0][0]} ${clean[0][1]}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const [x0, y0] = clean[i - 1];
    const [x1, y1] = clean[i];
    const [x2, y2] = clean[i + 1];
    const dx1 = Math.sign(x1 - x0);
    const dy1 = Math.sign(y1 - y0);
    const dx2 = Math.sign(x2 - x1);
    const dy2 = Math.sign(y2 - y1);
    const len1 = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    const len2 = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    const curve = Math.min(radius, len1 / 2, len2 / 2);
    if (curve < 1 || (dx1 === dx2 && dy1 === dy2)) {
      d += ` L ${x1} ${y1}`;
      continue;
    }
    d += ` L ${x1 - dx1 * curve} ${y1 - dy1 * curve} Q ${x1} ${y1} ${x1 + dx2 * curve} ${y1 + dy2 * curve}`;
  }
  const last = clean[clean.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

function labelPoint(points: Array<[number, number]>) {
  let best = points[0];
  let span = -1;
  for (let i = 1; i < points.length; i++) {
    const length = Math.abs(points[i][0] - points[i - 1][0]) + Math.abs(points[i][1] - points[i - 1][1]);
    if (length > span) {
      span = length;
      best = [(points[i][0] + points[i - 1][0]) / 2, (points[i][1] + points[i - 1][1]) / 2];
    }
  }
  return best;
}

function channelY(boxes: Box[], x1: number, x2: number, prefer: number) {
  let top = Infinity;
  let bottom = -Infinity;
  for (const box of boxes) {
    top = Math.min(top, box.y);
    bottom = Math.max(bottom, box.y + box.h);
  }
  const candidates = [prefer];
  for (const box of boxes) {
    candidates.push(box.y - 14, box.y + box.h + 14);
  }
  for (let i = 1; i <= 14; i++) {
    candidates.push(top - 18 - i * 13, bottom + 18 + i * 13);
  }
  for (const y of candidates) {
    if (!blocked(boxes, x1, y, x2, y)) return y;
  }
  return top - 36;
}

function clearX(boxes: Box[], y1: number, y2: number, prefer: number, direction: 1 | -1) {
  for (let i = 0; i < 18; i++) {
    const x = prefer + direction * i * 8;
    if (!blocked(boxes, x, y1, x, y2)) return x;
  }
  return prefer;
}

export function routeRelation(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sourceId: string,
  targetId: string,
  boxes: Box[],
  spread = 0,
) {
  const obstacles = boxes.filter(box => box.id !== sourceId && box.id !== targetId);
  const own = boxes.find(box => box.id === sourceId);
  const blocking = boxes;

  if (sourceId === targetId && own) {
    const right = own.x + own.w + 34;
    const left = own.x - 34;
    const aroundTop = own.y - 30;
    const aroundBottom = own.y + own.h + 30;
    const topHits = blocked(obstacles, left, aroundTop, right, aroundTop) || blocked(obstacles, right, sy, right, aroundTop) || blocked(obstacles, left, ty, left, aroundTop);
    const lane = topHits ? aroundBottom : aroundTop;
    const points = dedupe([[sx, sy], [right, sy], [right, lane], [left, lane], [left, ty], [tx, ty]] as Array<[number, number]>);
    const [labelX, labelY] = labelPoint(points);
    return {d: ortho(points), labelX, labelY};
  }

  const offset = (spread % 5) - 2;
  const mid = (sx + tx) / 2 + offset * 7;
  const gutterClear = !blocked(obstacles, sx, sy, mid, sy) && !blocked(obstacles, mid, sy, mid, ty) && !blocked(obstacles, mid, ty, tx, ty);
  if (tx > sx + 24 && gutterClear) {
    const points = dedupe([[sx, sy], [mid, sy], [mid, ty], [tx, ty]] as Array<[number, number]>);
    const [labelX, labelY] = labelPoint(points);
    return {d: ortho(points), labelX, labelY};
  }

  const direction = tx >= sx ? 1 : -1;
  const leave = clearX(blocking, sy, sy, sx + direction * 22, direction);
  const enter = clearX(blocking, ty, ty, tx - direction * 22, (direction * -1) as 1 | -1);
  const y = channelY(blocking, Math.min(leave, enter), Math.max(leave, enter), (sy + ty) / 2);
  const x1 = clearX(blocking, sy, y, leave, direction);
  const x2 = clearX(blocking, ty, y, enter, (direction * -1) as 1 | -1);
  const points = dedupe([[sx, sy], [x1, sy], [x1, y], [x2, y], [x2, ty], [tx, ty]] as Array<[number, number]>);
  const [labelX, labelY] = labelPoint(points);
  return {d: ortho(points), labelX, labelY};
}
