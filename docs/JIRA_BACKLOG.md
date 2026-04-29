# Jira Backlog Inicial

Este backlog esta listo para convertirse en Epics, Stories y Tasks dentro de Jira.

## Epic 1 - Fundacion Open Source

Objetivo: preparar el proyecto para desarrollo publico, seguro y mantenible.

- [Task] Configurar repositorio publico, licencia MIT y README.
- [Task] Documentar plan de producto y arquitectura.
- [Task] Configurar variables de entorno seguras con `.env.example`.
- [Task] Definir flujo SCRUM, Definition of Ready y Definition of Done.
- [Task] Definir guia visual inicial y convenciones CSS.

## Epic 2 - Identidad Y Autenticacion

Objetivo: permitir que los jugadores entren a la plataforma y administren su identidad.

- [Story] Como jugador quiero iniciar sesion para acceder a mis datos privados.
- [Story] Como jugador quiero configurar gamertag y gamertag_uid para identificarme en el Realm.
- [Story] Como jugador quiero elegir que datos son publicos para controlar mi perfil.
- [Task] Configurar Supabase Auth y proteccion de rutas.
- [Task] Definir modelo `profiles` y politicas RLS.

## Epic 3 - Registro Inmobiliario

Objetivo: registrar propiedades, delegaciones, duenos y porcentajes.

- [Story] Como gobierno quiero registrar delegaciones para ubicar propiedades.
- [Story] Como gobierno quiero registrar propiedades con tipo, tamano, direccion y valor.
- [Story] Como jugador quiero consultar mis propiedades y porcentajes.
- [Story] Como gobierno quiero crear unidades privativas dentro de una propiedad matriz.
- [Task] Definir modelo de datos de propiedades y propietarios.
- [Task] Agregar historial de valoracion de propiedades.

## Epic 4 - Economia Base

Objetivo: crear el flujo de dinero auditable del sistema.

- [Task] Crear billeteras para jugadores y organizaciones.
- [Task] Implementar ledger auditable para movimientos economicos.
- [Story] Como gobierno quiero registrar asistencia diaria de jugadores.
- [Story] Como jugador quiero recibir pago diario cuando mi asistencia sea registrada.
- [Story] Como organizacion quiero recibir pago proporcional segun socios asistentes.
- [Task] Implementar funciones atomicas para pagos diarios.

## Epic 5 - Organizaciones

Objetivo: permitir empresas privadas y sociedades entre jugadores.

- [Story] Como jugador quiero crear una organizacion privada.
- [Story] Como organizacion quiero invitar miembros.
- [Story] Como organizacion quiero repartir porcentajes entre socios.
- [Story] Como jugador quiero ver mis organizaciones y mi participacion.
- [Task] Calcular patrimonio inicial de organizacion.

## Epic 6 - Gobierno

Objetivo: modelar la organizacion publica unica del mundo.

- [Story] Como visitante quiero ver datos publicos del gobierno por transparencia.
- [Story] Como gobierno quiero administrar tierras sin dueno.
- [Story] Como gobierno quiero autorizar construcciones y modificaciones.
- [Story] Como gobierno quiero aplicar multas.
- [Story] Como gobierno quiero decomisar propiedades cuando aplique.
- [Task] Registrar acciones gubernamentales en audit log.

## Epic 7 - Foro Publico

Objetivo: mostrar construcciones y actividad del mundo.

- [Story] Como visitante quiero ver construcciones publicas.
- [Story] Como jugador quiero publicar una construccion nueva.
- [Story] Como jugador quiero comentar publicaciones.
- [Task] Configurar Supabase Storage para imagenes.
- [Task] Optimizar imagenes y paginacion del feed publico.

## Epic 8 - Mercado Y Ventas

Objetivo: permitir compraventa de propiedades o porcentajes.

- [Story] Como propietario quiero publicar en venta mi porcentaje de propiedad.
- [Story] Como comprador quiero hacer una oferta.
- [Story] Como vendedor quiero aceptar, rechazar o contraofertar.
- [Task] Validar saldo antes de aceptar operaciones.
- [Task] Transferir dinero y propiedad de forma atomica.

## Epic 9 - Subastas

Objetivo: habilitar pujas por tiempo y cierre automatico.

- [Story] Como vendedor quiero crear una subasta con duracion configurable.
- [Story] Como comprador quiero pujar como jugador u organizacion.
- [Story] Como participante quiero recibir notificaciones de nuevas pujas.
- [Task] Implementar cierre automatico de subastas.
- [Task] Transferir propiedad y dinero al finalizar.

## Epic 10 - Plusvalia Y Reportes

Objetivo: agregar dinamismo economico por delegacion.

- [Story] Como jugador quiero ver la plusvalia de una delegacion.
- [Story] Como gobierno quiero recalcular plusvalia con factores positivos y negativos.
- [Story] Como jugador quiero entender por que cambio el valor de mi propiedad.
- [Task] Registrar historial de indices de plusvalia.
- [Task] Crear reportes por delegacion.
