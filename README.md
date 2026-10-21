# Schema Atlas — Next.js Database Architecture Studio

A responsive, local-first **Next.js App Router** application for visual database-schema design, inspection, editing, export, and presentation. The default workspace is generated from the supplied PostgreSQL `schema.prisma` (12 models).

## Requirements
- Node.js 20 or newer
- npm

## Start
```bash
npm install
npm run dev
```
Open http://localhost:3000. Build for production with `npm run build && npm start`. Deploy to Vercel by importing this repository as a Next.js project; no environment variables are required for the standalone schema editor.

## Features
- Editable table/model canvas with pan, zoom, minimap, grid, snap-free drag positioning, fit-to-screen
- Prisma `.prisma` schema import / export; accepts copied Prisma schema text
- Basic `CREATE TABLE` SQL import and PostgreSQL SQL export
- Workspace JSON import/export including positions and styling
- Add / rename / delete models, fields, attributes, primary keys, nullability, types, mapped database table names and model directives
- Create foreign-key relationships using handles or Add relation selection mode
- Dagre automatic graph layout in horizontal or vertical direction
- Table header colors, dark/light color modes, connection style, labels, animation, compact cards
- Presentation mode, editable presentation title, legend, image export (PNG/SVG)
- Autosave to localStorage; undo/redo during the session; basic schema validation warnings
- Responsive sidebars and panels, with a searchable model explorer

## Important limitations
**This is a schema designer, not a live production database admin console.** It does not connect to databases or execute `ALTER TABLE`, `DROP TABLE`, or data migrations. Its editor operates on schema definitions in browser memory. Export the Prisma schema and review changes before using Prisma CLI migration tools. It does not provide logins, server-side collaboration, role permissions, or table record editing.

The built-in Prisma text parser supports model definitions, basic scalar fields, native `@db` types, `@map`, `@@map`, and `@relation(fields: ..., references: ...)`. It preserves field attribute strings but is **not a complete lossless Prisma AST implementation**: comments and custom multi-line constructs can be reordered, and advanced directives require verification. Advanced SQL, multi-line declarations, quoted identifiers, compound SQL indexes and foreign keys are only partly supported. SQL DDL exports are best-effort and need review. The exported Prisma schema still requires `prisma validate` before applying migrations.

## Project structure
- `app/` Next.js App Router UI and styling
- `components/Studio.tsx` interactive editor, inspector, import/export, settings, presentation
- `components/SchemaNode.tsx` ERD table card for React Flow
- `src/schema.ts` Prisma reader/writer, model editing, relation construction
- `src/sql.ts` basic SQL DDL parser/generator
- `examples/schema.prisma` original supplied schema
- `examples/default-schema.ts` embedded sample for standalone deployment

## Deployment
1. Push source to GitHub.
2. Import into Vercel. Framework preset: **Next.js**.
3. Build command `npm run build`. No database needed.
4. For production collaboration or direct live DB editing, add authenticated server routes, RBAC, auditing, and migration review workflows separately.

## Data privacy
The editor has no network API and persists your workspace using browser localStorage. In shared browsers, export a JSON backup and clear site storage when needed. Do not paste database passwords or other secrets; imported Prisma datasource `env("DATABASE_URL")` references are strings only and are never resolved.
