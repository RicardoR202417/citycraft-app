# CityCraft App - Plan De Proyecto

## Vision

CityCraft App sera la plataforma economica y social para una ciudad construida en un Realm de Minecraft Bedrock. El objetivo es reemplazar el control manual en Excel por un sistema abierto, auditable y facil de usar, donde el publico pueda conocer el mundo y los jugadores puedan administrar propiedades, dinero, organizaciones y mercado.

El proyecto sera open source, publico en GitHub y pensado para pocos usuarios autenticados: aproximadamente 15 a 20 jugadores. El foro publico puede recibir trafico variable, asi que las secciones publicas deberan usar paginacion, imagenes optimizadas y cache.

## Decisiones Principales

- Nombre del proyecto: `citycraft-app`.
- Repositorio publico en GitHub.
- Licencia: MIT.
- Lenguaje: JavaScript.
- Framework: Next.js App Router.
- Estilos: CSS Modules y CSS variables, sin Tailwind en la primera version.
- Backend: Supabase Auth, PostgreSQL, Storage y Realtime.
- Deploy: Vercel Hobby.
- No se importara el Excel actual; los datos se registraran manualmente desde cero.
- Las reglas economicas criticas deberan ejecutarse mediante transacciones de base de datos o funciones RPC.

## Roles

### Visitante Publico

Puede ver la exposicion del mundo, construcciones publicas, publicaciones del foro y perfiles publicos segun la visibilidad elegida por jugadores y organizaciones.

### Jugador

Puede iniciar sesion, administrar su perfil, consultar su billetera, ver sus propiedades, pertenecer a organizaciones, participar en ventas, subastas, transferencias y recibir notificaciones.

### Organizacion Privada

Puede tener miembros, porcentajes de participacion, billetera propia, propiedades a su nombre y participacion en compras, ventas, subastas y transferencias.

### Gobierno

Es una organizacion unica de tipo publico. Administra tierras sin dueno, permisos, multas, decomisos, asistencias, propiedades publicas y subastas gubernamentales. Su informacion debe ser totalmente transparente.

## Modulos

### Sitio Publico

Exposicion del mundo, foro publico de construcciones, perfiles publicos, propiedades visibles y publicaciones destacadas.

### Perfil De Jugador

Datos principales: gamertag, UID del gamertag, avatar, bio, visibilidad publica, billetera, propiedades, organizaciones y actividad economica.

### Propiedades

Cada propiedad tendra nombre, direccion, delegacion, tipo, tamano aproximado en bloques, valor, duenos, porcentaje de propiedad y estado.

Para edificios o complejos con interiores vendibles se usara:

- Propiedad matriz: edificio, torre, plaza, conjunto o desarrollo.
- Unidad privativa: departamento, oficina, local, interior o unidad registrable.

Esto se modelara con `parent_property_id`.

### Delegaciones

Las delegaciones permitiran agrupar propiedades por zona, medir cantidad, tipos, valor acumulado, actividad economica y plusvalia.

### Organizaciones

Las organizaciones privadas podran tener miembros con porcentajes de participacion. Su valor de mercado dependera de su billetera, propiedades, flujo diario estimado, estabilidad y actividad.

### Gobierno

El gobierno podra vender tierras sin dueno, construir propiedades publicas o de servicio, multar, decomisar, autorizar construcciones, registrar asistencias y administrar subastas publicas.

### Mercado Y Subastas

Los jugadores y organizaciones podran vender su porcentaje de una propiedad. Solo podran vender el 100% si son duenos unicos.

Las ventas aceptaran ofertas, contraofertas, rechazos y aceptaciones. Las subastas tendran duracion configurada y transferiran propiedad y dinero automaticamente al finalizar.

### Transferencias

Se podra transferir dinero o propiedades entre jugadores y organizaciones. Las transferencias grandes pagaran comision al gobierno. Las transferencias de propiedades pagaran impuesto segun el valor transferido. El gobierno no paga impuestos ni comisiones.

### Notificaciones

La bandeja incluira ventas, ofertas, contraofertas, cierre de subastas, nuevas pujas, multas, decomisos, transferencias, pagos diarios y cambios relevantes de propiedades.

## Modelo Economico Inicial

### Asistencia Y Pago Diario

El pago diario no se calculara automaticamente por conexion directa al Realm. El gobierno registrara manualmente la asistencia de cada jugador con base en la linea de tiempo del Realm.

Reglas:

- Una asistencia valida representa al menos 30 minutos de juego real.
- El gobierno registra la asistencia por jugador y dia.
- Cada jugador solo puede generar una asistencia pagada por dia real.
- Al registrar asistencia se procesan pagos directos al jugador.
- Las organizaciones reciben pago proporcional a los socios que si asistieron.

Formula base para organizaciones:

```txt
pago_org_del_dia = rendimiento_total_org * suma_porcentaje_socios_asistentes
```

Ejemplo: si una organizacion genera 10,000 diarios y solo asistio un socio con 40%, la organizacion recibe 4,000 ese dia.

### Rendimiento Por Propiedad

El rendimiento diario sera bajo para evitar inflacion. Los porcentajes exactos deberan guardarse como configuracion editable por el gobierno.

Tipos iniciales:

- Terreno.
- Habitacional.
- Local.
- Corporativo.
- Cultural.
- Entretenimiento.
- Infraestructura.
- Servicio publico.
- Propiedad gubernamental.

### Construccion Y Modificacion

Comprar un terreno no crea automaticamente una propiedad productiva. Para construir o modificar se requerira permiso del gobierno y costo de construccion segun tipo, tamano y plusvalia.

## Plusvalia

Cada delegacion tendra un indice de plusvalia inicial de `1.00`.

Limites recomendados:

- Minimo: `0.75`.
- Maximo inicial: `1.35`.
- Cambio maximo por recalculo: `+/-2.5%`.
- Cambio maximo semanal: `+/-7%`.

Formula propuesta:

```txt
objetivo = clamp(1 + score_delegacion / 100, 0.75, 1.35)
nuevo_indice = indice_actual + clamp((objetivo - indice_actual) * 0.25, -0.025, 0.025)
```

Factores positivos:

- Infraestructura nueva.
- Servicios publicos.
- Propiedades culturales y de entretenimiento.
- Diversidad de usos.
- Inversion reciente.
- Propiedades terminadas.
- Organizaciones estables.
- Baja concentracion de duenos.

Factores negativos:

- Demoliciones.
- Terrenos baldios acumulados.
- Abandono.
- Multas frecuentes.
- Alta concentracion en una sola organizacion.
- Falta de servicios.
- Decomisos frecuentes.

## Modelo De Datos Conceptual

- `profiles`: usuario, gamertag, gamertag_uid, avatar, bio y preferencias de visibilidad.
- `organizations`: organizaciones privadas y gobierno.
- `organization_members`: miembros, roles y porcentajes.
- `wallets`: billeteras de jugadores u organizaciones.
- `ledger_entries`: historial contable auditable.
- `districts`: delegaciones o colonias.
- `properties`: propiedades, matrices y unidades privativas.
- `property_owners`: duenos jugadores u organizaciones con porcentaje.
- `property_valuations`: historial de valoracion.
- `attendance_records`: asistencias registradas por gobierno.
- `daily_payouts`: pagos generados por asistencia.
- `construction_permits`: permisos de construccion, modificacion o demolicion.
- `listings`: ventas y subastas.
- `offers`: ofertas y contraofertas.
- `bids`: pujas.
- `transfers`: transferencias de dinero o propiedades.
- `notifications`: bandeja de eventos importantes.
- `forum_posts`: publicaciones publicas o autenticadas.
- `comments`: comentarios.
- `media_assets`: imagenes de construcciones.
- `government_actions`: multas, decomisos, autorizaciones y actos publicos.
- `audit_log`: registro tecnico de cambios sensibles.

## Seguridad Open Source

- Nunca commitear `.env`, `.env.local` ni llaves reales.
- Publicar solo `.env.example`.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente.
- Usar Row Level Security en Supabase.
- Separar permisos publicos, autenticados, propietarios, organizaciones y gobierno.
- Todo movimiento economico debe dejar evidencia en `ledger_entries`.
- Toda accion sensible debe registrarse en `audit_log`.
- Las funciones que mueven dinero o propiedades deben ser atomicas.

## Requerimientos Funcionales

### MVP

- Home publico del proyecto.
- Registro/login con Supabase Auth.
- Perfil de jugador con gamertag y gamertag_uid.
- Registro manual de propiedades.
- Registro de delegaciones.
- Billeteras.
- Organizaciones privadas.
- Gobierno unico.
- Registro de asistencia por gobierno.
- Pago diario por asistencia.
- Foro publico basico.
- Visibilidad publica configurable.

### Fase 2

- Mercado de ventas.
- Ofertas y contraofertas.
- Subastas en tiempo real.
- Transferencias con comisiones e impuestos.
- Notificaciones.
- Permisos de construccion.
- Multas y decomisos.

### Fase 3

- Calculo automatico de plusvalia.
- Reportes por delegacion.
- Valor de mercado de organizaciones.
- Elecciones de gobierno.
- Mapa visual del mundo.
- Simulador de construccion y rendimiento.

## Requerimientos No Funcionales

- App responsive.
- Bajo costo operativo.
- Seguridad compatible con repositorio publico.
- Auditoria completa de economia.
- Buen rendimiento en paginas publicas.
- Datos paginados.
- Imagenes optimizadas.
- Reglas economicas configurables.
- Base de datos preparada para migraciones futuras.

## Roadmap

1. Crear repositorio, documentacion base y estructura Next.js.
2. Configurar Supabase y variables de entorno.
3. Crear esquema inicial de base de datos y RLS.
4. Implementar perfiles y autenticacion.
5. Implementar propiedades, delegaciones y duenos.
6. Implementar billeteras y ledger.
7. Implementar gobierno y asistencia.
8. Implementar pagos diarios.
9. Implementar foro publico.
10. Implementar organizaciones.
11. Implementar mercado, ventas y subastas.
12. Implementar plusvalia y reportes.

## Criterios De Validacion

- El repo publico no contiene secretos.
- `.env.example` contiene solo placeholders.
- El visitante puede ver contenido publico sin login.
- El jugador solo accede a sus datos privados y datos publicos permitidos.
- El gobierno puede registrar asistencia.
- La asistencia genera pago directo al jugador.
- La asistencia genera pago parcial a organizaciones segun socios asistentes.
- Las propiedades con multiples duenos respetan porcentajes.
- Las ventas, subastas y transferencias fallan si no hay saldo suficiente.
- Toda transaccion economica genera historial en `ledger_entries`.
