# Vercel - CityCraft App

CityCraft App se despliega en Vercel desde GitHub.

## Objetivo

- Produccion desde la rama `main`.
- Preview deployments desde ramas y pull requests.
- Variables sensibles configuradas en Vercel, nunca en GitHub.
- `.env.local` solo para desarrollo local.

## Proyecto recomendado

- Nombre: `citycraft-app`
- Framework: Next.js
- Root directory: raiz del repositorio
- Production branch: `main`
- Install command: `npm install`
- Build command: `npm run build`

## Variables de entorno

Configurar en Vercel para Production, Preview y Development segun aplique:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_PROJECT_REF
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
NEXT_PUBLIC_APP_URL
```

Reglas:

- `NEXT_PUBLIC_*` puede estar disponible en navegador.
- `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` son secretos.
- No subir `.env.local`.
- No pegar secretos en issues, commits o PRs.

## Archivos excluidos

`.vercelignore` excluye:

- `.env`
- `.env.*`
- llaves privadas
- dumps de base de datos
- `.git`
- `.next`
- `node_modules`
- datos temporales de Supabase

Las migraciones SQL en `supabase/migrations/*.sql` si se conservan porque son
parte versionada del proyecto.

## Supabase Auth

Despues del primer deploy, actualizar en Supabase:

- Site URL: URL de produccion de Vercel.
- Redirect URLs:
  - `https://<vercel-domain>/login`
  - `https://<vercel-domain>/dashboard`
  - `http://localhost:3000/login`
  - `http://localhost:3000/dashboard`

## Flujo esperado

1. Hacer merge o push a `main`.
2. Vercel crea deployment de produccion.
3. PRs o ramas generan previews.
4. Validar cambios desde la URL de Vercel.

## Pendiente manual si no hay API de env vars

El conector disponible puede listar proyectos y deployments, pero no expone una
herramienta directa para crear variables de entorno. Si no se configura por CLI,
las variables deben capturarse desde el Dashboard de Vercel.
