'use client';
import {BaseEdge, EdgeLabelRenderer, type EdgeProps, useStore, useStoreApi} from '@xyflow/react';
import {useMemo} from 'react';
import {routeRelation, type Box} from '@/src/route';

export default function RelationEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const store = useStoreApi();
  const layoutKey = useStore(state => {
    let key = '';
    for (const node of state.nodeLookup.values()) {
      const position = node.internals?.positionAbsolute;
      key += `${node.id}:${position?.x ?? 0}:${position?.y ?? 0}:${node.measured?.width ?? 0}:${node.measured?.height ?? 0}|`;
    }
    return key;
  });
  const boxes = useMemo(() => {
    const next: Box[] = [];
    for (const node of store.getState().nodeLookup.values()) {
      const measured = node.measured;
      const position = node.internals?.positionAbsolute;
      next.push({
        id: node.id,
        x: position?.x ?? node.position.x,
        y: position?.y ?? node.position.y,
        w: measured?.width ?? node.width ?? 325,
        h: measured?.height ?? node.height ?? 80,
      });
    }
    return next;
  }, [store, layoutKey]);
  const spread = typeof data?.spread === 'number' ? data.spread : 0;
  const route = routeRelation(sourceX, sourceY, targetX, targetY, source, target, boxes, spread);
  return (
    <>
      <BaseEdge id={id} path={route.d} style={style} markerEnd={markerEnd} interactionWidth={18} />
      {label && (
        <EdgeLabelRenderer>
          <div className="relation-label" style={{transform: `translate(-50%, -50%) translate(${route.labelX}px, ${route.labelY}px)`}}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
