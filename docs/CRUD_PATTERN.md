# Patron de CRUD centralizado

CityCraft debe evitar que formularios, tablas y acciones queden repartidos en tarjetas aisladas. Cada modulo operativo debe seguir un patron comun para que gobierno, administrador y jugadores entiendan rapido donde buscar, filtrar, abrir detalle y ejecutar acciones.

## Objetivo

- Centralizar cada recurso en una vista principal con listado, filtros, acciones y estado vacio.
- Mantener formularios cerca del contexto donde se usan, pero sin duplicar logica visual.
- Separar permisos por accion: ver, crear, editar, operar, archivar y eliminar.
- Usar SILEO para feedback inmediato y conservar la bandeja de notificaciones para historial persistente.
- Priorizar tablas o listados densos para escritorio y layouts apilados claros para movil.

## Estructura de rutas

Cada recurso debe crecer con esta forma base:

- `/recurso`: listado centralizado con busqueda, filtros y acciones principales.
- `/recurso/new`: creacion cuando el flujo sea amplio o requiera varios pasos.
- `/recurso/[id-o-slug]`: detalle legible con datos completos, historial y acciones permitidas.
- `/recurso/[id-o-slug]/edit`: edicion cuando no convenga editar inline.

Si el formulario es pequeño, puede vivir dentro del detalle o del listado como panel lateral. Si modifica dinero, propiedad o permisos, debe ir por Server Action o RPC transaccional.

## Componentes base

Los componentes reutilizables viven en `components/ui/Crud.js`:

- `CrudLayout`: separacion vertical base para paginas CRUD.
- `CrudWorkspace`: area principal con sidebar opcional para detalle, filtros secundarios o formularios.
- `CrudToolbar`: formulario GET con busqueda, filtros y acciones principales.
- `CrudActionList`: grupo consistente de acciones por fila, detalle o bloque.
- `CrudPanel`: panel simple para agrupar formulario, detalle o resumen.

Estos componentes se combinan con `PageHeader`, `SectionHeader`, `Table`, `DataList`, `EmptyState`, `Button` y `LinkButton`.

## Busqueda y filtros

Toda vista centralizada debe incluir, cuando aplique:

- Campo `q` para busqueda por nombre, identificador, gamertag, propiedad o delegacion.
- Filtros por estado, tipo, delegacion, propietario u organizacion.
- Query params en URL para que el estado se pueda compartir y refrescar.
- Paginacion cuando el recurso pueda crecer.

Los filtros deben ejecutarse en servidor para evitar traer datos privados o innecesarios al cliente.

## Acciones

Las acciones deben ser visibles donde se toma la decision:

- Listado: abrir detalle, editar rapido, archivar, publicar/ocultar.
- Detalle: vender, subastar, transferir, solicitar modificacion, decomisar, revertir.
- Admin: todo lo anterior mas eliminar cuando el permiso global lo permita.

Las acciones destructivas deben usar variante visual de peligro, confirmacion cuando sea necesario y validacion de permisos en servidor. La UI nunca es la fuente de seguridad.

## Permisos

Cada accion debe declarar su alcance:

- `public`: visible para visitantes.
- `authenticated`: visible para jugadores con sesion.
- `owner`: jugador u organizacion propietaria.
- `government`: representante del gobierno.
- `admin`: administrador global unico.

El permiso de eliminar queda reservado a `admin`. Gobierno puede decomisar, editar datos gubernamentales y operar permisos, pero no debe tener eliminacion fisica salvo que tambien sea admin.

## Aplicacion por modulo

- Usuarios: listado de jugadores, busqueda por gamertag/UID, detalle de perfil, edicion admin.
- Propiedades y delegaciones: listado de propiedades con filtros por delegacion/tipo/estado, detalle completo, propietarios, valuaciones y acciones.
- Organizaciones: listado de organizaciones, miembros, porcentajes, patrimonio y mercado interno.
- Ventas y subastas: vista unificada de mercado con filtros por tipo, estado, propietario y participacion del usuario.
- Gobierno: CRUD operativo con permisos gubernamentales, auditoria y transparencia.
- Admin: mismos recursos con permisos ampliados, incluyendo eliminar y revertir.

## Estados

Cada CRUD debe cubrir:

- Cargando o pendiente cuando sea una accion cliente.
- Vacio cuando no hay resultados o no hay permisos.
- Error controlado con SILEO y mensaje claro.
- Exito con SILEO.
- Historial persistente cuando el evento tenga valor auditado.

## Ejemplo

```jsx
<CrudLayout>
  <PageHeader title="Propiedades" description="Registro centralizado por delegacion, tipo y propietario." />
  <CrudToolbar
    searchPlaceholder="Buscar propiedad"
    filters={[
      {
        name: "status",
        label: "Estado",
        options: [
          { value: "", label: "Todos" },
          { value: "active", label: "Activas" }
        ]
      }
    ]}
    actions={<LinkButton href="/properties/new">Nueva propiedad</LinkButton>}
  />
  <CrudWorkspace
    sidebar={<CrudPanel title="Resumen">...</CrudPanel>}
  >
    <Table columns={columns} rows={rows} getRowKey={(row) => row.id} />
  </CrudWorkspace>
</CrudLayout>
```

Este patron es la base para los siguientes sprints de depuracion visual y funcional. Cada modulo puede adaptar campos, pero no debe inventar una estructura nueva sin una razon fuerte.
