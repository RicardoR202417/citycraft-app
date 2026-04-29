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

## Documentacion del proyecto

La planeacion completa vive en [`PLAN.md`](./PLAN.md).

Documentos de trabajo:

- [`docs/PROJECT_MANAGEMENT.md`](./docs/PROJECT_MANAGEMENT.md): SCRUM, sprints, Definition of Ready y Definition of Done.
- [`docs/JIRA_BACKLOG.md`](./docs/JIRA_BACKLOG.md): backlog inicial listo para convertirse en issues de Jira.
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md): direccion visual, componentes y buenas practicas de estilos.
