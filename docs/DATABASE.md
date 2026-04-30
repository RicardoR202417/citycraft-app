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

## Administrador global

Archivo:

```text
supabase/migrations/20260430120000_global_admin_foundation.sql
```

Incluye:

- Tabla `global_admins` para registrar el unico administrador global activo.
- Indice unico `global_admins_single_active` para impedir mas de un admin
  activo al mismo tiempo.
- Funcion `is_global_admin(profile_id uuid default auth.uid())` como fuente
  segura de autorizacion desde RLS y backend.
- Politicas RLS para que el administrador global pueda leer o gestionar las
  tablas base existentes segun su naturaleza.

Reglas:

- El administrador global es distinto del gobierno.
- El gobierno administra reglas internas del mundo.
- El administrador global administra la plataforma completa.
- El alta o rotacion del administrador global debe hacerse con una operacion
  controlada de servidor o SQL usando credenciales seguras.
- El `service_role` nunca debe exponerse al navegador.

Ver tambien [`docs/ADMINISTRATION.md`](./ADMINISTRATION.md) para politicas
operativas, auditoria y rotacion.

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
  - `districts` listo en `20260430090000_property_registry.sql`.
  - `properties` listo en `20260430090000_property_registry.sql`.
  - `property_owners` listo en `20260430090000_property_registry.sql`.
  - `property_valuations` listo en `20260430090000_property_registry.sql`.
- Economia:
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

## Billeteras

Archivo:

```text
supabase/migrations/20260430140000_wallet_currency_foundation.sql
```

Incluye:

- Simbolo base de moneda ficticia: `CC$`.
- Defaults actualizados en `wallets.currency_symbol` y
  `ledger_entries.currency_symbol`.
- Normalizacion de wallets existentes.
- Creacion de wallets faltantes para perfiles y organizaciones existentes.

Reglas:

- Cada jugador debe tener exactamente una wallet.
- Cada organizacion debe tener exactamente una wallet.
- Los saldos no pueden ser negativos.
- Los nuevos flujos economicos no deben actualizar saldo sin generar ledger.

## Ledger economico

Archivo:

```text
supabase/migrations/20260430150000_ledger_foundation.sql
```

Incluye:

- Tipos de movimiento permitidos para `ledger_entries.entry_type`.
- Indices por wallet y fecha para consultar historiales recientes.
- Funcion interna `credit_wallet_with_ledger` para acreditar saldo y crear el
  movimiento auditable dentro de la misma transaccion.

Reglas:

- El ledger es la fuente de verdad historica de movimientos economicos.
- `wallets.balance` representa el saldo vigente para consultas rapidas.
- Toda mutacion futura de saldo debe pasar por una RPC transaccional.
- `credit_wallet_with_ledger` no se expone directo al cliente autenticado; la
  usaran RPCs especificas como pagos diarios, ajustes o cierres de mercado.
- La pantalla privada `/economy` muestra el saldo del jugador y sus ultimos
  movimientos visibles segun RLS.

## Asistencia diaria

Archivo:

```text
supabase/migrations/20260430160000_attendance_foundation.sql
```

Incluye:

- Tabla `attendance_records`.
- Indices por jugador, fecha y actor de gobierno.
- Politicas RLS para que cada jugador lea su propia asistencia y el gobierno
  administre el registro.
- RPC `record_attendance` para registrar una asistencia valida y generar
  auditoria.

Reglas:

- La asistencia la registra manualmente el gobierno con base en la linea de
  tiempo del Realm.
- Una asistencia valida requiere minimo 30 minutos y maximo 1440.
- Solo puede existir una asistencia por jugador y fecha real.
- `record_attendance` todavia no genera pago; el pago se conecta mediante una
  RPC atomica posterior para mantener el sprint incremental.
- Cada asistencia genera un evento `attendance.recorded` en `audit_logs`.

## Registro inmobiliario base

Archivo:

```text
supabase/migrations/20260430090000_property_registry.sql
```

Incluye:

- Tipos:
  - `property_type`: `land`, `residential`, `commercial`, `corporate`,
    `cultural`, `entertainment`, `infrastructure`, `service`, `public`.
  - `property_status`: `planned`, `active`, `under_review`, `demolished`,
    `archived`.
  - `property_owner_type`: `profile`, `organization`.
- Tablas:
  - `districts`: delegaciones o colonias.
  - `properties`: propiedades principales y soporte futuro para unidades con
    `parent_property_id`.
  - `property_owners`: participaciones por jugador u organizacion.
  - `property_valuations`: historial auditable de valoracion.
- Constraints:
  - Slugs normalizados.
  - Valores y tamanos no negativos.
  - Un propietario debe ser jugador u organizacion, nunca ambos.
  - La suma de porcentajes por propiedad no puede superar 100%.
- Funcion:
  - `is_government_member()` centraliza permisos de administracion publica.
- RLS:
  - Delegaciones y propiedades son legibles publicamente.
  - Propietarios son visibles para gobierno, dueno directo o miembros de la
    organizacion propietaria.
  - Valoraciones son legibles si la propiedad existe.
  - Solo gobierno puede administrar delegaciones, propiedades, propietarios y
    valoraciones.

Notas de modelado:

- `districts.base_appreciation_rate` prepara la plusvalia por zona sin activar
  aun el calculo automatico.
- `properties.current_value` representa el valor vigente para listados rapidos.
- `property_valuations` mantiene la historia; cada cambio futuro de valor debe
  crear una fila nueva.
- Las unidades privativas o interiores se representaran usando
  `parent_property_id`, pero su UI queda para un sprint posterior.

## RPC de registro de propiedades

Archivo:

```text
supabase/migrations/20260430100000_create_property_rpc.sql
supabase/migrations/20260430130000_property_units_rpc.sql
```

La funcion `create_property_with_initial_owner` crea de forma atomica:

- Una fila en `properties`.
- El propietario inicial en `property_owners`.
- La valoracion inicial en `property_valuations`.
- Un evento de auditoria `property.created`.

La migracion de unidades agrega `p_parent_property_id` para distinguir:

- Propiedad matriz: propiedad sin `parent_property_id`.
- Unidad privativa: propiedad con `parent_property_id`, por ejemplo
  departamento, oficina o local interior.

Reglas:

- Una unidad debe pertenecer a la misma delegacion que su matriz.
- Una unidad solo puede colgar de una propiedad matriz, no de otra unidad.
- Las unidades tienen propietarios y valoraciones propias.
- La auditoria usa `property.unit_created` cuando se registra una unidad.

La funcion solo puede ejecutarse por usuarios autenticados que pertenezcan a la
organizacion tipo `government`. La UI de gobierno debe usar esta RPC en lugar de
insertar directamente en varias tablas para evitar estados parciales.

## RPC de nuevas valoraciones

Archivo:

```text
supabase/migrations/20260430110000_record_property_valuation_rpc.sql
```

La funcion `record_property_valuation` permite al gobierno registrar una nueva
valoracion para una propiedad. En la misma transaccion:

- Actualiza `properties.current_value`.
- Inserta una fila historica en `property_valuations`.
- Agrega auditoria `property.valuation_recorded`.

Las filas historicas no se editan desde la UI comun; cada ajuste de valor debe
crear una nueva valoracion para mantener trazabilidad.
