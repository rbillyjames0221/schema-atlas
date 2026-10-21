export type Field = { id:string; name:string; type:string; optional:boolean; array:boolean; attributes:string; comment:string };
export type Table = {id:string; name:string; dbName:string; fields:Field[]; directives:string[]; comments:string[]; x?:number; y?:number; color?:string; collapsed?:boolean};
export type Relation = {id:string; source:string; target:string; sourceField:string; targetField:string; label:string; optional:boolean; inferred?:boolean};
export type Schema = {tables:Table[]; prefix:string; suffix:string; provider:string; title:string};
const uid=()=>Math.random().toString(36).slice(2,10);
const escapeRx=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export const physicalName=(field:Field)=>field.attributes.match(/@map\("([^"]+)"\)/)?.[1]||field.name;
export const dbName=(table:Table)=>table.directives.join(' ').match(/@@map\("([^"]+)"\)/)?.[1]||table.name;
export const baseType=(type:string)=>type.replace(/[?\[\]]/g,'');
export function tokenizeLine(line:string):Field|null {
 const m=line.trim().match(/^([A-Za-z_]\w*)\s+([A-Za-z_]\w*(?:\[\]|\?)?)(?:\s+(.*))?$/);
 if(!m)return null;
 const body=m[3]||''; let quote=false,depth=0,comment=-1;
 for(let i=0;i<body.length-1;i++){if(body[i]==='"'&&body[i-1]!=='\\')quote=!quote;if(!quote&&body[i]==='/'&&body[i+1]==='/'&&depth===0){comment=i;break} if(!quote&&body[i]==='(')depth++;if(!quote&&body[i]===')')depth=Math.max(0,depth-1)}
 const attrs=(comment>=0?body.slice(0,comment):body).trim();
 return {id:uid(),name:m[1],type:baseType(m[2]),optional:m[2].endsWith('?'),array:m[2].endsWith('[]'),attributes:attrs,comment:comment>=0?body.slice(comment+2).trim():''};
}
export function parsePrisma(input:string):Schema {
 const blocks=[...input.matchAll(/\b(?:model|view)\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)^\s*\}/gm)];
 const tables:Table[]=blocks.map((match,i)=>{
  const name=match[1],fields:Field[]=[],directives:string[]=[],comments:string[]=[];
  for(const raw of match[2].split(/\r?\n/)){const l=raw.trim();if(!l)continue;if(l.startsWith('///')||l.startsWith('//')){comments.push(l);continue}if(l.startsWith('@@')){directives.push(l);continue}const f=tokenizeLine(l);if(f)fields.push(f);else comments.push('// '+l)}
  return {id:uid(),name,dbName:directives.join(' ').match(/@@map\("([^"]+)"\)/)?.[1]||name,fields,directives,comments,x:(i%4)*375+80,y:Math.floor(i/4)*430+60};
 });
 const first=blocks[0];const last=blocks[blocks.length-1];
 // Strip model blocks, retain generator/datasource and other comments as opening context.
 const pre=first?input.slice(0,first.index):input;
 const post=last?input.slice((last.index||0)+last[0].length):'';
 const provider=input.match(/provider\s*=\s*"(postgresql|mysql|sqlite|sqlserver|mongodb|cockroachdb)"/)?.[1]||'postgresql';
 return {tables,prefix:pre,suffix:post,provider,title:'Government Workforce Schema'};
}
export function getRelations(s:Schema):Relation[]{
 const byName=new Map(s.tables.map(t=>[t.name,t]));const results:Relation[]=[];
 s.tables.forEach(t=>t.fields.forEach(f=>{
  const target=byName.get(f.type);if(!target)return;
  const args=f.attributes.match(/@relation\(([^\n]*?)\)/)?.[1]||'';
  const foreign=args.match(/fields:\s*\[([^\]]+)\]/)?.[1];const references=args.match(/references:\s*\[([^\]]+)\]/)?.[1];
  if(!foreign)return;
  const fk=foreign.split(',')[0].trim();const pk=references?.split(',')[0].trim()||'';
  results.push({id:`${t.id}:${f.id}:${target.id}`,source:t.id,target:target.id,sourceField:fk,targetField:pk,label:f.name,optional:f.optional});
 }));return results;
}
export const scalarFields=(t:Table,s:Schema)=>t.fields.filter(f=>!s.tables.some(model=>model.name===f.type));
export function serializePrisma(s:Schema):string{
 const head=s.prefix.trim()||`datasource db {\n  provider = "${s.provider}"\n  url      = env("DATABASE_URL")\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n}`;
 const body=s.tables.map(t=>{
  const fields=t.fields.map(f=>`  ${f.name.padEnd(29)} ${`${f.type}${f.array?'[]':f.optional?'?':''}`.padEnd(19)} ${f.attributes}${f.comment?' // '+f.comment:''}`.trimEnd()).join('\n');
  const directives=t.directives.join('\n  ');const comments=t.comments.length?t.comments.join('\n')+'\n':'';
  return `model ${t.name} {\n${comments}${fields}${directives?'\n\n  '+directives:''}\n}`;
 }).join('\n\n');
 return `${head}\n\n${body}${s.suffix.trim()?'\n\n'+s.suffix.trim():''}\n`;
}
export function newTable(name:string):Table{return {id:uid(),name,dbName:name,fields:[{id:uid(),name:'id',type:'Int',optional:false,array:false,attributes:'@id @default(autoincrement())',comment:''}],directives:[],comments:[]}}
export function newField():Field{return {id:uid(),name:'newField',type:'String',optional:false,array:false,attributes:'',comment:''}}
export function addRelation(s:Schema,sourceId:string,targetId:string):Schema{
 const tables=structuredClone(s.tables);const source=tables.find(t=>t.id===sourceId);const target=tables.find(t=>t.id===targetId);if(!source||!target)return s;
 const targetPk=target.fields.find(f=>/@id\b/.test(f.attributes))||target.fields.find(f=>f.name==='id');if(!targetPk)throw Error('Target table requires a primary key');
 const foreignType=targetPk.type;const base=target.name[0].toLowerCase()+target.name.slice(1);let fk=base+'Id';let n=2;while(source.fields.some(f=>f.name===fk))fk=base+'Id'+n++;
 let relationName=base;n=2;while(source.fields.some(f=>f.name===relationName))relationName=base+n++;
 let inverse=source.name[0].toLowerCase()+source.name.slice(1)+'s';n=2;while(target.fields.some(f=>f.name===inverse))inverse=source.name.toLowerCase()+'s'+n++;
 const relationTag=source.id===target.id?`"${source.name}Parent"`:'';
 source.fields.push({id:uid(),name:fk,type:foreignType,optional:true,array:false,attributes:'',comment:''});
 source.fields.push({id:uid(),name:relationName,type:target.name,optional:true,array:false,attributes:`@relation(${relationTag?relationTag+', ':''}fields: [${fk}], references: [${targetPk.name}])`,comment:''});
 target.fields.push({id:uid(),name:inverse,type:source.name,optional:false,array:true,attributes:relationTag?`@relation(${relationTag})`:'',comment:''});
 return {...s,tables};
}
export function renameTableReferences(s:Schema,oldName:string,newName:string){return {...s,tables:s.tables.map(t=>({...t,fields:t.fields.map(f=>({...f,type:f.type===oldName?newName:f.type}))}))}}
export function safeName(name:string){return /^[A-Za-z_]\w*$/.test(name)}
export function validateSchema(s:Schema):string[]{const issues:string[]=[];const names=new Set<string>();s.tables.forEach(t=>{if(!safeName(t.name))issues.push(`Invalid model name: ${t.name}`);if(names.has(t.name))issues.push(`Duplicate model: ${t.name}`);names.add(t.name);const fs=new Set();t.fields.forEach(f=>{if(!safeName(f.name))issues.push(`Invalid field: ${t.name}.${f.name}`);if(fs.has(f.name))issues.push(`Duplicate field: ${t.name}.${f.name}`);fs.add(f.name)});if(!t.fields.some(f=>/@id\b/.test(f.attributes))&&!t.directives.some(x=>x.includes('@@id')))issues.push(`${t.name}: no primary key`)});getRelations(s).forEach(r=>{const t=s.tables.find(x=>x.id===r.source)!;if(!t.fields.some(f=>f.name===r.sourceField))issues.push(`${t.name}: missing foreign key field ${r.sourceField}`)});return issues}
export function cleanDeletedTable(s:Schema,id:string){const gone=s.tables.find(t=>t.id===id);if(!gone)return s;return {...s,tables:s.tables.filter(t=>t.id!==id).map(t=>({...t,fields:t.fields.filter(f=>f.type!==gone.name)}))}}
export function removeRelation(s:Schema,id:string){const rel=getRelations(s).find(r=>r.id===id);if(!rel)return s;const source=s.tables.find(t=>t.id===rel.source)!;const target=s.tables.find(t=>t.id===rel.target)!;const field=source.fields.find(f=>f.name===rel.label)!;const fk=source.fields.find(f=>f.name===rel.sourceField);
 return {...s,tables:s.tables.map(t=>({...t,fields:t.fields.filter(f=>{
 if(t.id===source.id&&(f.id===field.id ||(fk&&f.id===fk.id&&fk.name.endsWith('Id')&&!source.fields.some(other=>other.id!==field.id&&other.attributes.includes(`[${fk.name}]`)))))return false;
 if(t.id===target.id&&f.type===source.name&&f.array&&(!f.attributes||f.attributes===field.attributes.match(/@relation\("([^"]+)"/)?.[0]))return false;
 return true})}))};
}
export function renamePhysicalTable(t:Table,value:string):Table {const directive=`@@map("${value.replaceAll('"','')}")`;return {...t,dbName:value,directives:[...t.directives.filter(d=>!d.startsWith('@@map(')),directive]}}
export function renamePhysicalField(f:Field,value:string):Field {const rest=f.attributes.replace(/\s*@map\("[^"]+"\)/g,'');return {...f,attributes:(rest+' @map("'+value.replaceAll('"','')+'")').trim()}}
export function replaceNameInAttrs(attrs:string,oldName:string,newName:string){return attrs.replace(new RegExp(`\\b${escapeRx(oldName)}\\b`,'g'),newName)}
