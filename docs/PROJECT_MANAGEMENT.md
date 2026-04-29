# Project Management - CityCraft App

Este documento define como se administrara CityCraft App con Jira, SCRUM y sprints.

## Metodologia

CityCraft App se trabajara con SCRUM ligero:

- Sprint recomendado: 2 semanas.
- Ceremonias:
  - Sprint Planning: seleccionar historias del backlog.
  - Daily async: avances, bloqueos y siguiente paso.
  - Sprint Review: demo funcional al final del sprint.
  - Retrospective: mejorar proceso, calidad y alcance.
- Tablero Jira:
  - Backlog.
  - Selected for Sprint.
  - In Progress.
  - In Review.
  - QA / Validation.
  - Done.

## Tipos De Issue

- Epic: grupo grande de funcionalidad.
- Story: funcionalidad visible para visitantes, jugadores, organizaciones o gobierno.
- Task: trabajo tecnico, setup, documentacion, arquitectura o refactor.
- Bug: comportamiento incorrecto.
- Spike: investigacion acotada antes de decidir implementacion.

## Definition Of Ready

Una tarea esta lista para entrar a sprint cuando tiene:

- Objetivo claro.
- Usuario o rol afectado.
- Criterios de aceptacion.
- Dependencias identificadas.
- Riesgos de seguridad o datos anotados.
- Tamano estimado en story points.

## Definition Of Done

Una tarea se considera terminada cuando:

- El comportamiento esta implementado.
- El codigo sigue la arquitectura y estilo del proyecto.
- La UI es responsive cuando aplica.
- No se exponen secretos.
- Las rutas privadas validan permisos.
- Hay validacion manual o automatizada.
- La documentacion se actualiza si cambia una regla importante.
- El cambio esta en GitHub mediante PR o commit revisable.

## Estimacion

Usaremos Fibonacci:

- 1: cambio pequeno y claro.
- 2: tarea simple con poco riesgo.
- 3: tarea mediana.
- 5: tarea con varias piezas o incertidumbre moderada.
- 8: tarea grande que deberia dividirse si es posible.

## Cronograma Inicial

### Sprint 0 - Fundacion Del Proyecto

Objetivo: dejar el proyecto listo para desarrollo continuo.

- Repositorio publico.
- Documentacion base.
- Estructura Next.js.
- Guia de gestion.
- Guia visual.
- Preparacion de Supabase.

### Sprint 1 - Autenticacion Y Perfil

Objetivo: permitir que jugadores reales entren a la plataforma y tengan identidad.

- Login con Supabase Auth.
- Perfil de jugador.
- Campos `gamertag` y `gamertag_uid`.
- Preferencias de visibilidad.
- Layout base de app autenticada.

### Sprint 2 - Registro Inmobiliario

Objetivo: crear el nucleo del registro de propiedades.

- Delegaciones.
- Propiedades.
- Propiedad matriz y unidades privativas.
- Duenos y porcentajes.
- Valoracion inicial.

### Sprint 3 - Economia Base

Objetivo: crear billeteras, ledger y flujo de asistencia.

- Billeteras de jugadores y organizaciones.
- Ledger auditable.
- Gobierno unico.
- Registro de asistencia.
- Pago diario a jugadores.
- Pago proporcional a organizaciones.

### Sprint 4 - Organizaciones

Objetivo: permitir empresas y sociedades entre jugadores.

- Crear organizaciones privadas.
- Invitar miembros.
- Definir participaciones.
- Consultar flujo y patrimonio.
- Reglas basicas de salida o venta de porcentaje.

### Sprint 5 - Foro Publico Y Exposicion

Objetivo: mostrar el mundo al publico.

- Feed de construcciones.
- Publicaciones con imagenes.
- Comentarios.
- Perfiles publicos.
- Paginacion y optimizacion de imagenes.

### Sprint 6 - Mercado

Objetivo: permitir compraventa inicial.

- Publicaciones de venta.
- Ofertas.
- Contraofertas.
- Transferencia atomica de dinero y propiedad.
- Notificaciones basicas.

### Sprint 7 - Subastas

Objetivo: habilitar pujas y cierres automaticos.

- Configuracion de subastas.
- Pujas en tiempo real.
- Cierre por tiempo.
- Validacion de saldo.
- Transferencia automatica al ganador.

### Sprint 8 - Plusvalia Y Reportes

Objetivo: hacer que la economia evolucione por zona.

- Indice de plusvalia por delegacion.
- Factores positivos y negativos.
- Historial de valoracion.
- Reportes por delegacion.

## Monitoreo De Avance

Metricas utiles en Jira:

- Velocity por sprint.
- Burndown chart.
- Issues completados vs comprometidos.
- Bugs abiertos por sprint.
- Lead time desde "Selected" hasta "Done".
- Tareas bloqueadas.

## Cadencia Recomendada

- 1 sprint cada 2 semanas.
- 1 objetivo principal por sprint.
- Maximo 1 epic dominante por sprint.
- Mantener tareas de 1 a 5 puntos siempre que sea posible.
- Dividir cualquier issue de 8 puntos antes de empezarlo.
