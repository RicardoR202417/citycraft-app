# Development Workflow - CityCraft App

Esta guia define el flujo base para desarrollar CityCraft App con Jira,
GitHub, Supabase y Next.js.

## Requisitos

- Node.js `>=22`.
- npm.
- Acceso al proyecto de Supabase.
- Variables locales en `.env.local`.
- Git configurado con acceso al repositorio.

## Instalacion local

```bash
npm install
npm run dev
```

URL local:

```text
http://localhost:3000
```

Guia visual navegable:

```text
http://localhost:3000/style-guide
```

## Variables de entorno

Copiar `.env.example` a `.env.local` y llenar valores reales.

Reglas:

- `.env.local` nunca se commitea.
- `NEXT_PUBLIC_*` puede usarse en cliente.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` y `DATABASE_URL` solo se
  usan en servidor, scripts o migraciones.

## Flujo Git + Jira

Usaremos ramas por issue:

```text
codex/CCAPP-XX-descripcion-corta
```

Ejemplos:

```text
codex/CCAPP-16-login-auth
codex/CCAPP-21-property-registry
```

Commits:

```text
CCAPP-16 Add login form
CCAPP-19 Protect dashboard routes
```

Pull requests:

- El titulo debe iniciar con la clave Jira.
- La descripcion debe mencionar alcance, validaciones y riesgos.
- Cada PR debe apuntar a `main`.
- Cambios pequenos pueden agrupar tareas relacionadas del mismo Epic.

## Orden de trabajo

1. Tomar una issue desde Jira.
2. Crear rama con prefijo `codex/`.
3. Implementar el cambio con alcance acotado.
4. Ejecutar validaciones.
5. Actualizar documentacion si cambia arquitectura, datos o UI base.
6. Commit con referencia Jira.
7. Push y PR.

## Validaciones

Antes de cerrar una tarea:

```bash
npm run lint
npm run build
```

Cuando haya cambios de base de datos:

- Agregar migracion en `supabase/migrations`.
- Documentar en `docs/DATABASE.md` si cambia el modelo.
- Verificar RLS.
- No usar `service_role` en cliente.

## Estructura de app

```text
app/
  (app)/          Rutas privadas autenticadas.
  (public)/       Rutas publicas agrupadas.
  components/     Componentes locales de rutas especiales.
components/
  ui/             Componentes reutilizables genericos.
  domain/         Componentes del dominio CityCraft.
lib/
  auth/           Helpers de sesion y permisos.
  supabase/       Clientes Supabase.
```

## Convenciones UI

- CSS Modules por componente.
- Variables globales desde `app/globals.css`.
- Componentes con radio maximo de `8px`.
- Iconos desde `lucide-react`.
- Notificaciones con Sileo.
- Cantidades de dinero con simbolo `₵`.

## Supabase Auth

La primera version usa email/password.

Rutas base:

- `/login`: acceso y registro.
- `/dashboard`: primera ruta privada protegida.

Las rutas privadas se protegen con `proxy.js` y helpers de servidor.

## Vercel

Antes del primer deploy se deben cargar variables reales en Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`

No se deben exponer secretos en el repositorio publico.
