# CityCraft App

CityCraft App es una plataforma open source para administrar y mostrar la economia ficticia de una ciudad construida en un Realm de Minecraft Bedrock.

El proyecto combina un foro publico de construcciones con una app privada para jugadores, propiedades, organizaciones, mercado, subastas, gobierno, asistencia diaria y flujo economico.

## Stack

- Next.js App Router con JavaScript
- CSS Modules y CSS variables
- Supabase Auth, PostgreSQL, Storage y Realtime
- Vercel Hobby para despliegue
- Licencia MIT

## Seguridad

Este repositorio es publico. No se deben commitear secretos, dumps de base de datos ni llaves privadas.

Usa `.env.example` como referencia y guarda valores reales solamente en `.env.local`, Supabase o Vercel Environment Variables.

## Desarrollo local

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

Rutas utiles durante la fundacion:

- `http://localhost:3000/style-guide`: laboratorio visual.
- `http://localhost:3000/login`: acceso y registro con Supabase Auth.
- `http://localhost:3000/dashboard`: primera ruta privada protegida.

## Documentacion del proyecto

La planeacion completa vive en [`PLAN.md`](./PLAN.md).

Documentos de trabajo:

- [`docs/PROJECT_MANAGEMENT.md`](./docs/PROJECT_MANAGEMENT.md): SCRUM, sprints, Definition of Ready y Definition of Done.
- [`docs/JIRA_BACKLOG.md`](./docs/JIRA_BACKLOG.md): backlog inicial listo para convertirse en issues de Jira.
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md): direccion visual, componentes y buenas practicas de estilos.
- [`docs/CRUD_PATTERN.md`](./docs/CRUD_PATTERN.md): patron reusable para listados, filtros, detalles, formularios y acciones.
- [`docs/DATABASE.md`](./docs/DATABASE.md): Supabase, migraciones, RLS y reglas de seguridad.
- [`docs/ADMINISTRATION.md`](./docs/ADMINISTRATION.md): politicas del administrador global y separacion con gobierno.
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md): flujo Git/Jira, ramas, PRs y convenciones de desarrollo.
- [`docs/VERCEL.md`](./docs/VERCEL.md): deploy, variables de entorno y configuracion de Vercel.
