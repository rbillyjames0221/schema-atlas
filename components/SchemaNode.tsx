'use client';
import {Handle, Position, type NodeProps} from '@xyflow/react';
import {KeyRound, Link2, MoreHorizontal, Table2} from 'lucide-react';
import type {Field} from '@/src/schema';

export type SchemaNodeData = {
  name: string;
  dbName: string;
  fields: Field[];
  color: string;
  compact: boolean;
  onEdit: (id: string) => void;
  nodeId: string;
  selected: boolean;
  relationFields: string[];
  pkFields: string[];
};

export default function SchemaNode({data}: NodeProps) {
  const d = data as unknown as SchemaNodeData;
  const foreignKeys = new Set(d.relationFields || []);
  const referencedKeys = new Set(d.pkFields || []);
  return (
    <div className={`schema-node ${d.selected ? 'active' : ''}`} style={{'--node-accent': d.color} as React.CSSProperties}>
      <div className="node-heading">
        <span className="node-symbol"><Table2 size={14} /></span>
        <div className="node-titles">
          <strong title={d.name}>{d.dbName.toUpperCase()}</strong>
          <small>{d.name}</small>
        </div>
        <button className="icon-btn node-menu nodrag" onClick={() => d.onEdit(d.nodeId)} title="Edit table"><MoreHorizontal size={17} /></button>
      </div>
      {!d.compact && (
        <div className="node-fields">
          {d.fields.map(field => {
            const isPk = /@id\b/.test(field.attributes) || referencedKeys.has(field.name);
            const isFk = foreignKeys.has(field.name);
            const mapped = field.attributes.match(/@map\("([^"]+)"\)/)?.[1] || field.name;
            return (
              <div className="node-field" key={field.id}>
                {isFk && <Handle type="target" id={`fk:${field.name}`} position={Position.Left} className="node-handle fk-handle" />}
                <span className={isPk ? 'field-key pk' : isFk ? 'field-key fk' : 'field-key'}>
                  {isPk ? <KeyRound size={12} /> : isFk ? <Link2 size={12} /> : <span className="field-dot" />}
                </span>
                <span className={isPk ? 'field-name primary' : isFk ? 'field-name foreign' : 'field-name'} title={field.name}>{mapped}</span>
                <span className="field-type">{field.type}{field.array ? '[]' : field.optional ? '?' : ''}{isPk ? ' [PK]' : isFk ? ' [FK]' : ''}</span>
                {referencedKeys.has(field.name) && <Handle type="source" id={`pk:${field.name}`} position={Position.Right} className="node-handle pk-handle" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
