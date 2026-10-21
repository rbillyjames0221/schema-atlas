import type {Schema,Table,Field} from './schema';
const uid=()=>Math.random().toString(36).slice(2,10);
export function parseSQL(sql:string):Schema{
 const tables:Table[]=[];const fkRows:{table:string,column:string,target:string,reference:string}[]=[];
 const matches=[...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`\[]?(\w+)["`\]]?\.)?["`\[]?(\w+)["`\]]?\s*\(([\s\S]*?)\)\s*;/gi)];
 for(const [idx,m] of matches.entries()){
  const fields:Field[]=[];const directives:string[]=[];const lines=m[3].split(/,\s*\n/).map(v=>v.trim()).filter(Boolean);
  for(const line of lines){
   const fk=line.match(/(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(["`]?([\w]+)["`]?\)\s+REFERENCES\s+["`]?([\w]+)["`]?\s*\(["`]?([\w]+)["`]?\)/i);
   if(fk){fkRows.push({table:m[2],column:fk[1],target:fk[2],reference:fk[3]});continue}
   const pk=line.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
   if(pk){directives.push(`@@id([${pk[1].replace(/["`]/g,'').replace(/\s*,\s*/g,', ')}])`);continue}
   const col=line.match(/^["`\[]?(\w+)["`\]]?\s+([\w]+)(?:\((\d+)(?:,\s*(\d+))?\))?\s*(.*)$/i);
   if(!col)continue;const [,name,raw,n,d,rest]=col;
   let type='String',native='';const upper=raw.toUpperCase();
   if(/^(INT|INTEGER|SMALLINT|SERIAL)$/.test(upper))type='Int';else if(/^(BIGINT|BIGSERIAL)$/.test(upper))type='BigInt';else if(/^(BOOL|BOOLEAN)$/.test(upper))type='Boolean';else if(/^(TIMESTAMP|DATE|DATETIME|TIME)$/.test(upper))type='DateTime';else if(/^(DECIMAL|NUMERIC|REAL|FLOAT|DOUBLE)$/.test(upper))type='Decimal';else if(/^(TEXT|VARCHAR|CHAR|UUID)$/.test(upper))type='String';else if(/^(JSON|JSONB)$/.test(upper))type='Json';else if(/^(BYTEA|BLOB)$/.test(upper))type='Bytes';
   if(upper==='VARCHAR'&&n)native=`@db.VarChar(${n})`;if(upper==='TEXT')native='@db.Text';if(upper==='DATE')native='@db.Date';if(upper==='DECIMAL'&&n)native=`@db.Decimal(${n}, ${d||0})`;
   const isPk=/PRIMARY\s+KEY/i.test(rest);const nullable=!isPk&&!/NOT\s+NULL/i.test(rest);
   const attributes=[isPk?'@id':'',/UNIQUE/i.test(rest)?'@unique':'',/DEFAULT\s+CURRENT_TIMESTAMP/i.test(rest)?'@default(now())':'',native].filter(Boolean).join(' ');
   fields.push({id:uid(),name,type,optional:nullable,array:false,attributes,comment:''});
  }
  tables.push({id:uid(),name:m[2],dbName:m[2],fields,directives,comments:[],x:70+(idx%3)*410,y:70+Math.floor(idx/3)*380});
 }
 for(const r of fkRows){const t=tables.find(x=>x.name===r.table),target=tables.find(x=>x.name===r.target);if(!t||!target)continue;const property=r.target[0].toLowerCase()+r.target.slice(1);t.fields.push({id:uid(),name:property,type:target.name,optional:true,array:false,attributes:`@relation(fields: [${r.column}], references: [${r.reference}])`,comment:''});target.fields.push({id:uid(),name:t.name[0].toLowerCase()+t.name.slice(1)+'List',type:t.name,optional:false,array:true,attributes:'',comment:''})}
 return {tables,prefix:'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n}',suffix:'',provider:'postgresql',title:'Imported SQL Schema'};
}
export function exportSQL(schema:Schema){const typeMap:Record<string,string>={Int:'INTEGER',BigInt:'BIGINT',String:'TEXT',Boolean:'BOOLEAN',DateTime:'TIMESTAMP',Decimal:'DECIMAL',Float:'DOUBLE PRECISION',Json:'JSONB',Bytes:'BYTEA'};
 return schema.tables.map(t=>{
  const scalars=t.fields.filter(f=>!schema.tables.some(other=>other.name===f.type));
  const columns=scalars.map(f=>{let type=typeMap[f.type]||'TEXT';const v=f.attributes.match(/@db\.VarChar\((\d+)\)/);if(v)type=`VARCHAR(${v[1]})`;const dec=f.attributes.match(/@db\.Decimal\(([^)]+)\)/);if(dec)type=`DECIMAL(${dec[1]})`;const name=f.attributes.match(/@map\("([^"]+)"\)/)?.[1]||f.name;return `  "${name}" ${type}${f.optional?'':' NOT NULL'}${/@id\b/.test(f.attributes)?' PRIMARY KEY':''}${/@unique\b/.test(f.attributes)?' UNIQUE':''}`});
  const fk=t.fields.filter(f=>schema.tables.some(other=>other.name===f.type)&&/@relation\(/.test(f.attributes));for(const f of fk){const ref=f.attributes.match(/fields:\s*\[([^\]]+)\].*references:\s*\[([^\]]+)\]/);if(!ref)continue;columns.push(`  FOREIGN KEY ("${ref[1].trim()}") REFERENCES "${schema.tables.find(x=>x.name===f.type)?.dbName||f.type}"("${ref[2].trim()}")`)}
  return `CREATE TABLE "${t.dbName}" (\n${columns.join(',\n')}\n);`}).join('\n\n')+'\n';}
