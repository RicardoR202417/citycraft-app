# Administracion Global - CityCraft App

Este documento define las reglas del administrador global de la plataforma. El
administrador global no representa al gobierno dentro del Realm; representa el
mantenimiento tecnico y operativo de CityCraft App.

## Roles

### Administrador global

- Accede al panel `/admin`.
- Puede consultar y corregir datos base de la plataforma.
- Puede usar herramientas administrativas que requieren `service_role`, siempre
  del lado servidor.
- Debe dejar trazabilidad en `audit_logs` cuando modifique datos sensibles.
- Solo puede existir un administrador global activo.

### Gobierno

- Accede al panel `/government`.
- Representa la entidad publica dentro del mundo.
- Registra delegaciones, propiedades, valoraciones, asistencias, multas y
  operaciones de gobierno cuando esos modulos existan.
- Sus datos deben ser transparentes para los jugadores.
- Su vista publica vive en `/transparency/government` y expone perfil, wallet,
  propiedades, movimientos permitidos y acciones recientes sin requerir login.
- Administra tierras sin dueño desde `/government`: puede registrarlas,
  reservarlas, marcarlas disponibles, ponerlas como venta o subasta y dejar
  auditoria de cada cambio.
- Revisa solicitudes de construccion, modificacion o demolicion desde
  `/government`; cada decision requiere comentario y puede actualizar tipo,
  tamano, valor o estado de la propiedad.

### Jugadores y organizaciones

- Administran su perfil, propiedades y participaciones segun permisos normales.
- No tienen acceso al panel global.
- No deben depender de privilegios tecnicos para realizar operaciones del mundo.

## Modelo tecnico

La migracion `20260430120000_global_admin_foundation.sql` crea:

- Tabla `global_admins`.
- Indice unico `global_admins_single_active`.
- Funcion `is_global_admin(profile_id uuid default auth.uid())`.
- Politicas RLS transversales para acceso administrativo.

El backend usa:

- `isGlobalAdmin(supabase, profileId)` para consultar permisos.
- `requireGlobalAdminProfile(next)` para bloquear rutas admin.

Las rutas admin deben validar primero la sesion del usuario. Si una accion
necesita `service_role`, se debe llamar despues de esa validacion y solo en
Server Components, Server Actions o Route Handlers.

## Alta inicial del administrador

El alta inicial se hace manualmente desde SQL o una operacion segura de servidor.
No debe existir una pantalla publica para autoasignarse como administrador.

Ejemplo SQL:

```sql
insert into public.global_admins (profile_id, reason)
select id, 'bootstrap inicial'
from public.profiles
where gamertag = '<gamertag-del-admin>';
```

Si ya existe un administrador activo, el indice singleton rechazara otro alta
activa. Eso es intencional.

## Rotacion del administrador

La rotacion debe ser explicita, auditada y ejecutada con credenciales seguras.

Ejemplo SQL:

```sql
begin;

update public.global_admins
set is_active = false
where is_active = true;

insert into public.global_admins (profile_id, reason)
select id, 'rotacion de administrador'
from public.profiles
where gamertag = '<nuevo-gamertag-admin>';

commit;
```

Cuando exista UI para rotacion, debe:

- Confirmar el usuario destino.
- Registrar actor, motivo y fecha.
- Impedir dejar el sistema sin administrador activo salvo mantenimiento
  deliberado.

## Acciones que requieren auditoria

Deben insertar un evento en `audit_logs`:

- Correcciones de perfiles de jugadores.
- Cambios de duenios o porcentajes de propiedades.
- Cambios de organizaciones o membresias.
- Ajustes de wallets o ledger.
- Reversiones, compensaciones o anulaciones operativas.
- Cambios de gobierno o permisos especiales.
- Cambios de configuracion economica.

Formato recomendado:

- `actor_profile_id`: perfil que ejecuto la accion.
- `action`: verbo estable, por ejemplo `admin.profile_updated`.
- `entity_type`: entidad afectada, por ejemplo `profile`.
- `entity_id`: identificador afectado.
- `metadata`: campos relevantes sin secretos.

## Reversiones y correcciones

Las operaciones economicas no deben borrarse fisicamente. Cuando exista ledger:

- Un error se corrige con un movimiento compensatorio.
- La accion original permanece en historial.
- La compensacion explica el motivo en `metadata`.
- El usuario afectado debe poder ver el resultado cuando sus permisos lo
  permitan.

Para datos no economicos:

- Se permite actualizar el estado vigente.
- Se debe conservar auditoria del cambio.
- Eliminaciones definitivas quedan reservadas para mantenimiento tecnico.

## Reglas de seguridad

- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en componentes cliente.
- Nunca exponer `DATABASE_URL`, password de base de datos o service role en UI.
- No crear endpoints admin sin `requireGlobalAdminProfile`.
- No aceptar `profile_id` del cliente como prueba de permisos.
- No guardar secretos en `audit_logs.metadata`.
- Mantener RLS activo aunque una accion use service role en servidor.
- Preferir RPC transaccionales para operaciones multi-tabla.

## Estado actual

Implementado:

- Base SQL de administrador global.
- Guardia backend.
- Panel `/admin`.
- Seccion `/admin/players` para correccion inicial de perfiles.
- Seccion `/admin/organizations` para corregir socios, roles y porcentajes.
- Seccion `/admin/properties` para corregir propiedades, propietarios y
  porcentajes sin sustituir el flujo de valoraciones del gobierno.
- Seccion `/admin/audit` para consultar `audit_logs`, revisar `ledger_entries`
  y revertir acreditaciones mediante movimientos compensatorios.
- Vista publica `/transparency/government` para transparencia del gobierno.
- Flujo de tierras sin dueño con `government_disposition`, RPCs auditados y
  exposicion publica en transparencia.
- Flujo de permisos con `property_permit_requests`: los jugadores solicitan
  desde `/properties` y el gobierno aprueba o rechaza con cambios atomicos.

Pendiente:

- Seleccionar y registrar el administrador global activo.
- Reglas especificas de reversion para ventas, subastas y transferencias
  complejas cuando esos modulos existan.
