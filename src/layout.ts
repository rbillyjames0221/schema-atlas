import {getRelations, type Schema, type Table} from './schema';

const NODE_W = 325;
const HEADER = 68;
const ROW = 25;
const GAP_Y = 78;
const GUTTER_X = 156;

export function tableCardHeight(table: Table) {
  return HEADER + table.fields.length * ROW;
}

function reaches(start: string, goal: string, next: Map<string, Set<string>>) {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === goal) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const child of next.get(id) || []) stack.push(child);
  }
  return false;
}

/** Place referenced (PK) tables to the left of the tables that point at them. */
export function organizeRelations(schema: Schema): Schema {
  const links = getRelations(schema).filter(r => r.sourceField && r.targetField);
  const ids = schema.tables.map(t => t.id);
  const parents = new Map<string, Set<string>>(ids.map(id => [id, new Set()]));
  const children = new Map<string, Set<string>>(ids.map(id => [id, new Set()]));
  const linked = new Set<string>();

  for (const link of links) {
    linked.add(link.source);
    linked.add(link.target);
    if (link.source === link.target) continue;
    const parent = link.target;
    const child = link.source;
    if (reaches(child, parent, children)) continue;
    if (parents.get(child)!.has(parent)) continue;
    parents.get(child)!.add(parent);
    children.get(parent)!.add(child);
  }

  const rank = new Map<string, number>(ids.map(id => [id, 0]));
  const indegree = new Map<string, number>(ids.map(id => [id, parents.get(id)!.size]));
  const queue = ids.filter(id => indegree.get(id) === 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of children.get(id) || []) {
      rank.set(child, Math.max(rank.get(child) || 0, (rank.get(id) || 0) + 1));
      indegree.set(child, (indegree.get(child) || 1) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }

  const byId = new Map(schema.tables.map(t => [t.id, t]));
  const columns = new Map<number, string[]>();
  const isolated: string[] = [];
  for (const id of ids) {
    if (!linked.has(id)) {
      isolated.push(id);
      continue;
    }
    const column = rank.get(id) || 0;
    const list = columns.get(column) || [];
    list.push(id);
    columns.set(column, list);
  }

  const ranks = [...columns.keys()].sort((a, b) => a - b);
  for (const column of ranks) {
    columns.get(column)!.sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name));
  }

  const indexOf = () => {
    const index = new Map<string, number>();
    for (const column of ranks) columns.get(column)!.forEach((id, i) => index.set(id, i));
    return index;
  };
  const average = (idsForNode: Set<string>, index: Map<string, number>, fallback: number) => {
    if (!idsForNode.size) return fallback;
    let total = 0;
    for (const id of idsForNode) total += index.get(id) ?? fallback;
    return total / idsForNode.size;
  };

  for (let pass = 0; pass < 6; pass++) {
    const index = indexOf();
    for (const column of ranks) {
      if (column === ranks[0]) continue;
      columns.get(column)!.sort((a, b) => average(parents.get(a)!, index, index.get(a)!) - average(parents.get(b)!, index, index.get(b)!) || byId.get(a)!.name.localeCompare(byId.get(b)!.name));
    }
    const back = indexOf();
    for (let i = ranks.length - 1; i > 0; i--) {
      const column = ranks[i - 1];
      columns.get(column)!.sort((a, b) => average(children.get(a)!, back, back.get(a)!) - average(children.get(b)!, back, back.get(b)!) || byId.get(a)!.name.localeCompare(byId.get(b)!.name));
    }
  }

  const position = new Map<string, {x: number; y: number}>();
  ranks.forEach((column, columnIndex) => {
    let y = 96;
    for (const id of columns.get(column)!) {
      position.set(id, {x: 48 + columnIndex * (NODE_W + GUTTER_X), y});
      y += tableCardHeight(byId.get(id)!) + GAP_Y;
    }
  });

  if (isolated.length) {
    isolated.sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name));
    let y = 96;
    const x = 48 + (ranks.length || 0) * (NODE_W + GUTTER_X);
    for (const id of isolated) {
      position.set(id, {x, y});
      y += tableCardHeight(byId.get(id)!) + GAP_Y;
    }
  }

  return {
    ...schema,
    tables: schema.tables.map(table => {
      const next = position.get(table.id);
      return next ? {...table, x: next.x, y: next.y} : table;
    }),
  };
}
