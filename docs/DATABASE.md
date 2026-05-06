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
  - Pago proporcional a organizaciones por socios asistentes
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

## Storage de imagenes

Archivo:

```text
supabase/migrations/20260430280000_construction_image_storage.sql
```

Incluye:

- Bucket privado `construction-images` en Supabase Storage.
- Tabla `media_assets` para registrar metadatos auditables de cada imagen.
- Politicas de Storage para impedir escrituras anonimas.
- Politicas RLS para separar imagenes privadas, publicas, gobierno y
  administrador global.
- Helper de aplicacion en `lib/storage/constructionImages.js`.

Reglas:

- El bucket inicia como privado para evitar exposicion accidental de imagenes.
- Los usuarios autenticados solo pueden subir objetos dentro de una carpeta con
  su propio UUID de perfil: `<profile_id>/<archivo>`.
- El tamano maximo recomendado por imagen es `5 MB`.
- Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- Cada objeto debe tener una fila correspondiente en `media_assets`.
- `media_assets.is_public = true` es la fuente para decidir si una imagen puede
  aparecer en foro publico, perfiles publicos o vistas de exposicion.
- Las URLs publicas o firmadas solo deben generarse desde servidor despues de
  validar la visibilidad del registro en `media_assets`.
- El cliente no debe construir URLs publicas manualmente para objetos privados.

## Construcciones publicas

Archivo:

```text
supabase/migrations/20260430290000_public_construction_posts.sql
```

Incluye:

- Tabla `construction_posts` para publicaciones del foro/exposicion.
- Vista `public_construction_posts` para visitantes anonimos.
- Politicas RLS para mostrar solo publicaciones publicas y publicadas.
- Relaciones opcionales con propiedad, delegacion e imagen de Storage.

Reglas:

- `/constructions` carga sin login usando la llave anonima de Supabase.
- Solo aparecen publicaciones con `is_public = true` y `published_at <= now()`.
- La vista publica expone titulo, resumen, autor visible, delegacion,
  propiedad relacionada e imagen aprobada.
- Si la portada vive en Storage, la aplicacion genera una URL firmada desde
  servidor solo despues de leer el registro publico.
- Las publicaciones privadas o futuras no aparecen en el feed anonimo.

## Mercado y ventas

Archivo:

```text
supabase/migrations/20260430300000_market_sale_listings.sql
```

Incluye:

- Tipo `market_listing_status`: `active`, `paused`, `sold`, `cancelled`.
- Tabla `market_listings` para publicar propiedades o porcentajes en venta.
- RPC `create_market_sale_listing`.
- Funcion `calculate_property_owner_available_percent`.
- Auditoria `market.listing_created`.

Reglas:

- La publicacion siempre apunta a una fila real de `property_owners`.
- Un jugador solo puede publicar participaciones directas a su nombre.
- Una organizacion solo puede publicar si el actor es `owner` o `admin` activo.
- El porcentaje publicado no puede superar el porcentaje disponible.
- Las publicaciones `active` y `paused` reservan porcentaje hasta que se vendan
  o cancelen.
- Si el propietario tiene 100%, puede publicar el 100% como venta completa.
- Las publicaciones guardan precio base, moneda, vendedor, propiedad y estado.
- La ruta privada `/market` permite crear publicaciones y listar ventas activas.
- Ofertas, contraofertas, validacion de saldo y cierre atomico se agregan por
  historias separadas del epic de mercado.

### Ofertas de mercado

Archivo:

```text
supabase/migrations/20260430310000_market_offers.sql
```

Incluye:

- Tipo `market_offer_status`: `pending`, `accepted`, `rejected`, `countered`,
  `withdrawn`, `expired`.
- Tabla `market_offers` para ofertas de compra sobre publicaciones activas.
- RPC `create_market_offer`.
- Notificacion `market_offer_created` para el vendedor.
- Auditoria `market.offer_created`.

Reglas:

- Un comprador puede ofertar como jugador o como organizacion donde sea miembro
  activo.
- El saldo de la wallet elegida debe ser suficiente al momento de ofertar.
- La oferta queda en estado `pending` y no mueve dinero todavia.
- El vendedor recibe una notificacion dirigida a su perfil u organizacion.
- La ruta `/market` muestra ofertas enviadas y recibidas.

### Respuestas a ofertas

Archivo:

```text
supabase/migrations/20260430320000_market_offer_responses.sql
```

Incluye:

- Columnas `seller_response`, `counter_amount` y `responded_by` en
  `market_offers`.
- RPC `respond_market_offer`.
- Notificacion `market_offer_response` para el comprador.
- Auditoria `market.offer_responded`.

Reglas:

- Solo el vendedor directo o un `owner/admin` de la organizacion vendedora puede
  responder una oferta.
- Solo ofertas `pending` pueden recibir respuesta.
- El vendedor puede `accepted`, `rejected` o `countered`.
- Si contraoferta, `counter_amount` debe ser mayor a `0`.
- Al aceptar, la publicacion pasa a `paused` para evitar nuevas negociaciones
  mientras se prepara el cierre.
- Al aceptar, la RPC vuelve a bloquear y validar la wallet del comprador. Si ya
  no hay saldo suficiente, falla sin modificar oferta ni publicacion.
- Aceptar una oferta no mueve dinero ni propiedad todavia; el cierre atomico se
  implementa en una historia posterior.

### Guardas de saldo en mercado

Archivo:

```text
supabase/migrations/20260430330000_market_offer_balance_guards.sql
```

Incluye:

- Funcion `market_offer_has_sufficient_funds`.
- Validacion transaccional de saldo dentro de `respond_market_offer` al aceptar.
- Campos `accepted_balance_checked_at` y `accepted_balance_snapshot` en
  `market_offers`.

Reglas:

- El saldo se valida al ofertar y se vuelve a validar al aceptar.
- El chequeo de aceptacion usa `for update` sobre la wallet del comprador.
- Si el saldo no alcanza, la respuesta falla antes de modificar estado o enviar
  notificacion.
- `/market` muestra si una oferta pendiente todavia tiene fondos suficientes.
- El cierre atomico posterior debera volver a validar saldo antes de transferir
  dinero y propiedad.

### Cierre atomico de mercado

Archivo:

```text
supabase/migrations/20260430340000_market_atomic_settlement.sql
```

Incluye:

- RPC `settle_market_offer`.
- Ajuste de `market_listings.property_owner_id` para conservar historial aunque
  el vendedor venda el 100% y su fila de propiedad desaparezca.
- Transferencia de saldo entre wallets.
- Actualizacion de `property_owners`.
- Ledger `property_sale`.
- Notificaciones `market_sale_settled`.
- Auditoria `market.sale_settled`.

Reglas:

- Solo se pueden cerrar ofertas `accepted`.
- El cierre puede ejecutarlo comprador o vendedor involucrado.
- La oferta, publicacion, wallet compradora, wallet vendedora y propiedad del
  vendedor se bloquean dentro de la transaccion.
- Si el comprador ya no tiene saldo suficiente, nada se modifica.
- Si el vendedor ya no tiene porcentaje suficiente, nada se modifica.
- Si se vende el 100% de una participacion, la fila del vendedor se elimina.
- Si el comprador ya tenia porcentaje sobre la propiedad, se suma; si no,
  se crea una nueva fila de propietario.
- La publicacion queda `sold` y otras ofertas pendientes de la misma publicacion
  pasan a `expired`.

## Subastas

Archivo:

```text
supabase/migrations/20260430350000_auction_foundation.sql
supabase/migrations/20260430360000_auction_bids.sql
```

Incluye:

- Tipo `auction_status`: `active`, `cancelled`, `settled`, `expired`.
- Tabla `auctions` para publicar subastas de propiedades o porcentajes.
- RPC `create_auction`.
- Funcion `calculate_property_owner_reserved_percent`.
- Actualizacion de `calculate_property_owner_available_percent` para restar
  ventas activas/pausadas y subastas activas vigentes.
- Auditoria `auction.created`.

Reglas:

- Una subasta siempre apunta a una fila real de `property_owners` al momento de
  crearse.
- Un jugador solo puede subastar participaciones directas a su nombre.
- Una organizacion solo puede subastar si el actor es `owner` o `admin` activo.
- El porcentaje subastado no puede superar el porcentaje disponible.
- Las subastas `active` y con `ends_at > now()` reservan porcentaje junto con
  las ventas activas o pausadas.
- Las duraciones permitidas de la primera version son `20` minutos, `10` horas,
  `1` dia y `1` semana.
- La ruta privada `/auctions` permite crear subastas y listar subastas activas.
- La tabla `auction_bids` y la RPC `create_auction_bid` permiten pujar como
  jugador u organizacion con saldo suficiente.
- Solo puede existir una puja `leading` por subasta activa.
- La primera puja debe cubrir el precio inicial de la subasta.
- Las siguientes pujas deben superar la puja lider vigente.
- Cuando una nueva puja lider entra, la anterior pasa a `outbid`.
- Cierre automatico, notificaciones de puja superada y liquidacion atomica se
  implementan en historias posteriores del epic de subastas.

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

## Organizaciones privadas

Archivo:

```text
supabase/migrations/20260430180000_private_organization_rpc.sql
```

Incluye:

- RPC `create_private_organization`.
- Creacion atomica de organizacion tipo `private`.
- Alta del creador como `owner` inicial con `100%`.
- Auditoria `organization.created`.
- Wallet automatica mediante el trigger existente de `organizations`.

Reglas:

- Solo usuarios autenticados pueden crear organizaciones privadas.
- El slug debe ser unico y normalizado.
- La organizacion puede marcarse visible o privada mediante `is_public`.
- La administracion fina de socios y porcentajes se entrega en historias
  posteriores del epic de organizaciones.

## Participaciones de organizaciones

Archivo:

```text
supabase/migrations/20260430190000_organization_member_shares.sql
```

Incluye:

- Funcion `is_active_organization_member`.
- Funcion `is_organization_admin`.
- Politica RLS para leer membresias de organizaciones donde el jugador
  pertenece activamente.
- Trigger `organization_members_enforce_percent`.
- RPC `update_organization_member_share`.

Reglas:

- La suma de `ownership_percent` de socios activos no puede superar 100%.
- La organizacion debe conservar al menos un socio activo con rol `owner`.
- Solo `owner` o `admin` de la organizacion pueden cambiar rol o porcentaje.
- Cada cambio queda auditado como `organization.member_share_updated`.
- Estos porcentajes son la base para el pago proporcional de organizaciones.
- El administrador global puede corregir miembros desde `/admin/organizations`
  usando acciones de servidor con `service_role`, pero cada cambio debe generar
  auditoria `admin.organization_member_*`.

## Patrimonio inicial de organizaciones

Archivo:

```text
supabase/migrations/20260430200000_organization_market_value.sql
```

Incluye:

- RPC `calculate_organization_market_value`.
- Calculo centralizado del patrimonio inicial de una organizacion.
- Validacion de acceso para miembros activos, administrador global o
  `service_role`.

Formula v1:

```text
patrimonio = saldo_wallet + valor_propiedades_proporcional + ajuste_estabilidad + ajuste_actividad
```

Reglas:

- `saldo_wallet` se toma de la wallet de la organizacion.
- `valor_propiedades_proporcional` suma solo propiedades activas donde la
  organizacion sea propietaria directa, respetando su porcentaje.
- `ajuste_estabilidad` y `ajuste_actividad` inician en `0` para preparar el
  calculo futuro de estabilidad economica, actividad de socios y plusvalia.
- La respuesta incluye `formula_version` para poder evolucionar el calculo sin
  perder trazabilidad.
- El perfil de organizacion y el panel admin consumen esta RPC para evitar
  formulas duplicadas en la interfaz.

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
- `record_attendance` queda como base de bajo nivel; la UI de gobierno usa
  `record_attendance_and_daily_payout` para generar asistencia y pago directo
  en una sola transaccion.
- Cada asistencia genera un evento `attendance.recorded` en `audit_logs`.

## Pagos diarios

Archivo:

```text
supabase/migrations/20260430170000_daily_payout_rpc.sql
supabase/migrations/20260430210000_organization_daily_payouts.sql
```

Incluye:

- Tabla `daily_payouts`.
- Tabla `organization_daily_payouts`.
- Politicas RLS para lectura del jugador y administracion de gobierno.
- RPC `record_attendance_and_daily_payout`.

Reglas:

- El pago diario directo se genera al marcar asistencia desde gobierno.
- La RPC registra asistencia, calcula pago, crea `daily_payouts`, actualiza la
  wallet, inserta `ledger_entries` y audita `daily_payout.created` en una sola
  transaccion.
- Si cualquier paso falla, nada se persiste.
- El rendimiento inicial directo usa el valor vigente de propiedades activas
  donde el jugador sea propietario directo:
  `sum(valor_propiedad * porcentaje_jugador) * 0.001`.
- Si el jugador no tiene valor inmobiliario directo, la asistencia se registra
  y el pago queda en `0`, sin entrada de ledger.
- La RPC tambien revisa organizaciones donde el jugador asistente sea socio
  activo con participacion mayor a `0`.
- Por cada organizacion, calcula el rendimiento total diario con propiedades
  activas a nombre de la organizacion:
  `rendimiento_total_org = sum(valor_propiedad * porcentaje_org) * 0.001`.
- El pago proporcional usa:
  `pago_org_del_dia = rendimiento_total_org * porcentaje_socio_asistente`.
- Si ningun socio de una organizacion registra asistencia valida ese dia, esa
  organizacion no recibe pago.
- Cada pago positivo a organizacion acredita su wallet y genera un movimiento
  `daily_org_payout` en `ledger_entries`.
- Los pagos organizacionales, incluso si son `0`, quedan trazados en
  `organization_daily_payouts` para auditoria por asistencia, socio y fecha.
- El jugador puede consultar sus pagos en `/economy`; gobierno puede revisar
  pagos recientes en `/government`; los miembros pueden revisar pagos recientes
  desde el detalle de su organizacion.

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

## Plusvalia v1

La plusvalia visible para jugadores se calcula en aplicacion con
`lib/appreciation.js` usando los datos actuales de `districts` y `properties`.
No modifica valores de propiedades todavia; muestra un indice operativo para
entender cada zona y permite al gobierno guardar snapshots auditables.

Formula conceptual:

```text
indice_actual =
  districts.base_appreciation_rate
  + ajuste_por_construcciones_y_proyectos
  + ajuste_por_servicios_e_infraestructura
  + ajuste_por_actividad_reciente
  +/- ajuste_por_concentracion_economica
  + ajuste_por_valor_por_bloque
  - ajuste_por_terreno_sin_desarrollar
  - ajuste_por_demoliciones_e_inactividad
```

Reglas:

- Los ajustes son pequenos y acotados para evitar cambios bruscos.
- El recalculo compara contra el ultimo snapshot persistido; si no existe, usa
  `districts.base_appreciation_rate`.
- El cambio maximo por snapshot es `2.5` puntos porcentuales.
- El indice final siempre se limita al rango `-100` a `100`.
- La tendencia compara `indice_actual` contra el ultimo indice usado como base
  del recalculo.
- `/districts` muestra indice actual, factores principales y tendencia por
  delegacion.
- `/districts` incluye reportes por delegacion con propiedades por tipo, valor
  acumulado, plusvalia actual, historial resumido y actividad reciente para
  detectar zonas con mayor movimiento.
- `/properties` muestra la plusvalia de la delegacion de cada propiedad directa
  del jugador.
- `/properties` tambien cruza `property_valuations` con el ultimo snapshot de
  `district_appreciation_history` para explicar valor anterior, valor actual,
  cambio proporcional, impacto estimado de plusvalia y razon auditable.
- El gobierno puede guardar snapshots desde `/government`.
- La version de formula actual es `appreciation_v2` y guarda en `factors` el
  indice bruto, limite aplicado, cambio maximo, valor total, bloques, tendencia
  y factores de explicacion.

## Historial de plusvalia

Archivo:

```text
supabase/migrations/20260430270000_district_appreciation_history.sql
```

Incluye:

- Tabla `district_appreciation_history`.
- RPC `record_district_appreciation_snapshot`.
- Auditoria `government.district_appreciation_recorded`.

Reglas:

- Solo el gobierno puede registrar snapshots.
- Cada fila conserva delegacion, indice anterior, indice nuevo, cambio
  calculado, razon, factores y actor.
- El indice anterior se toma del ultimo snapshot de la delegacion; si no existe,
  usa `districts.base_appreciation_rate`.
- El historial puede consultarse desde `/government`.
- La tabla queda lista para alimentar reportes futuros por delegacion y fecha.

## Multas gubernamentales

Archivo:

```text
supabase/migrations/20260430250000_government_fines.sql
```

Incluye:

- Tabla `government_fines` para multas a jugadores u organizaciones.
- Tabla base `notifications` para avisos importantes del sistema.
- Tipo de ledger `government_fine`.
- RPC `apply_government_fine`.

Reglas:

- Solo miembros del gobierno pueden aplicar multas.
- La multa requiere destinatario, monto y razon.
- Si el destinatario tiene saldo suficiente, se transfiere dinero al gobierno y
  se crea `ledger_entries`.
- Si no hay saldo suficiente, la multa queda como `debt` sin mover dinero.
- En ambos casos se crea notificacion y auditoria `government.fine_applied`.

## Decomisos gubernamentales

Archivo:

```text
supabase/migrations/20260430260000_government_property_seizures.sql
```

Incluye:

- Tabla `government_property_seizures`.
- RPC `seize_property_for_government`.

Reglas:

- Solo miembros del gobierno pueden decomisar propiedades.
- El decomiso requiere razon documentada.
- Los propietarios anteriores se guardan en `previous_owners`.
- La propiedad queda con un propietario unico: gobierno al 100%.
- Se crean notificaciones para propietarios previos y auditoria
  `government.property_seized`.

## Auditoria gubernamental

El panel `/government` consulta `audit_logs` para mostrar un historial interno
de acciones sensibles con:

- Actor (`actor_profile_id`).
- Fecha (`created_at`).
- Entidad afectada (`entity_type`, `entity_id`).
- Razon operativa derivada de `metadata`, sin guardar secretos.

Acciones gubernamentales cubiertas actualmente:

- `government.fine_applied`: multas.
- `government.property_seized`: decomisos.
- `government.permit_request_approved` y
  `government.permit_request_rejected`: permisos.
- `government.unowned_land_created` y
  `government.unowned_land_disposition_updated`: tierras sin dueño, venta o
  subasta preparada.
- `property.created`, `property.unit_created` y
  `property.valuation_recorded`: registro inmobiliario administrado por
  gobierno.
- `attendance.recorded`, `daily_payout.created` y
  `organization_daily_payout.created`: asistencia y pagos.

La vista publica `/transparency/government` reutiliza estos eventos con datos
filtrados: muestra nombre legible de la accion, entidad, actor y fecha, pero no
expone `metadata` completo.
