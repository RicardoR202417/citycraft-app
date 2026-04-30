# Database - CityCraft App

CityCraft App usa Supabase para Auth, PostgreSQL, Storage y Realtime. La base de
datos se administra con migraciones SQL versionadas en el repo.

## Proyecto Supabase

- Project ref: `whlxmdelaqmfybalgres`
- Region: `us-east-2`
- URL publica esperada: `https://whlxmdelaqmfybalgres.supabase.co`

Los secretos reales viven solo en `.env.local`, Supabase y, mas adelante,
variables de entorno de Vercel. Nunca deben commitearse.

## Variables locales

Crear `.env.local` a partir de `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-public-anon-key"
SUPABASE_PROJECT_REF="your-project-ref"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_DB_PASSWORD="your-database-password"
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Reglas:

- `NEXT_PUBLIC_*` puede usarse en cliente.
- `SUPABASE_SERVICE_ROLE_KEY` solo puede usarse en servidor o scripts seguros.
- `DATABASE_URL` y `SUPABASE_DB_PASSWORD` nunca deben exponerse al navegador.
- `.env.local` esta ignorado por Git.

## Migracion inicial

Archivo:

```text
supabase/migrations/20260430042000_initial_foundation.sql
```

Incluye:

- Extension `pgcrypto`.
- Tipos:
  - `organization_type`: `private`, `government`.
  - `organization_member_role`: `owner`, `admin`, `member`.
- Tablas:
  - `profiles`
  - `organizations`
  - `organization_members`
  - `wallets`
  - `ledger_entries`
  - `audit_logs`
- Triggers:
  - `updated_at` automatico.
  - Creacion automatica de `profile` cuando se crea un usuario en Auth.
  - Creacion automatica de wallet para perfiles.
  - Creacion automatica de wallet para organizaciones.
- Registro inicial:
  - `Gobierno de CityCraft`, organizacion publica unica tipo `government`.
- Row Level Security inicial.

## Politicas RLS iniciales

Las politicas iniciales son deliberadamente conservadoras:

- Visitantes leen perfiles publicos mediante la vista limitada
  `public_profiles`, no desde la tabla privada `profiles`.
- Cada jugador puede leer y actualizar su propio perfil completo.
- Cada jugador puede leer su wallet.
- Miembros pueden leer wallets y datos de organizaciones a las que pertenecen.
- El gobierno se modela como organizacion publica y transparente.
- `ledger_entries` y `audit_logs` son de solo lectura desde cliente.
- Movimientos economicos futuros deben pasar por funciones SQL/RPC atomicas.

## Modelo `profiles`

La tabla `profiles` guarda la identidad privada del jugador y esta vinculada a
`auth.users`.

Campos principales:

- `id`: UUID del usuario autenticado.
- `gamertag`: nombre visible dentro del Realm.
- `gamertag_uid`: identificador unico del gamertag cuando este disponible.
- `display_name`, `avatar_url`, `bio`: datos de presentacion.
- `visibility_settings`: JSON con banderas de visibilidad publica.
- `created_at`, `updated_at`: trazabilidad base.

Las banderas heredadas `public_profile` y `public_wallet` se mantienen por
compatibilidad inicial, pero la configuracion granular vive en
`visibility_settings`.

La vista `public_profiles` expone solo campos permitidos por las banderas de
visibilidad. La tabla `profiles` completa solo es legible por el usuario dueno.

Visibilidad inicial disponible:

- `profile`: habilita o deshabilita el perfil publico completo.
- `gamertag`: muestra el gamertag.
- `gamertag_uid`: muestra el UID del gamertag.
- `avatar`: muestra avatar cuando exista.
- `bio`: muestra biografia cuando exista.
- `wallet`: prepara visibilidad publica de billetera.
- `organizations`: prepara visibilidad publica de organizaciones.
- `properties`: prepara visibilidad publica de propiedades.

## Aplicar migraciones

Opcion con `psql`:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260430042000_initial_foundation.sql
```

En PowerShell:

```powershell
$env:PGPASSWORD = "<database-password>"
psql -h "db.<project-ref>.supabase.co" -U "postgres" -d "postgres" -f "supabase/migrations/20260430042000_initial_foundation.sql"
```

Opcion con Supabase CLI, si se instala despues:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Siguientes migraciones previstas

Las siguientes tablas se agregaran por Epic/historia, no todas desde el inicio:

- Registro inmobiliario:
  - `districts`
  - `properties`
  - `property_owners`
  - `property_valuations`
- Economia:
  - `attendance_records`
  - `daily_payouts`
  - RPC de pago diario
- Mercado:
  - `market_listings`
  - `offers`
- Subastas:
  - `auctions`
  - `auction_bids`
- Foro:
  - `forum_posts`
  - `forum_comments`
  - `media_assets`
- Notificaciones:
  - `notifications`

## Auth foundation

La base de autenticacion ya incluye:

- Cliente browser en `lib/supabase/browser.js`.
- Cliente server con cookies en `lib/supabase/server.js`.
- Proxy de Next.js para proteger `/dashboard`.
- Helpers en `lib/auth`.
- Ruta publica `/login`.
- Ruta privada `/dashboard`.

Supabase Auth usa email/password como primer proveedor. Mas adelante se puede
agregar OAuth si el grupo lo necesita.

## Principio de seguridad

El repositorio es publico. Por eso:

- No commitear `.env.local`.
- No commitear dumps de base de datos.
- No usar `service_role` en componentes cliente.
- Mantener RLS activo en tablas publicas.
- Encapsular operaciones economicas en RPC transaccionales.
- Registrar dinero en `ledger_entries` y acciones sensibles en `audit_logs`.
