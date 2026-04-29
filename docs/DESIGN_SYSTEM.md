# Design System - CityCraft App

La interfaz de CityCraft App debe sentirse moderna, minimalista y ligeramente inspirada en Minecraft sin copiar su UI de forma literal.

## Principios Visuales

- Minimalista, clara y funcional.
- Inspiracion Minecraft: bloques, ciudad, mapas, propiedad, materiales y economia.
- No usar estilos caricaturescos ni saturados.
- Evitar pantallas pesadas tipo landing si la vista debe ser una herramienta.
- Preferir layouts escaneables, con informacion densa pero ordenada.
- Usar componentes reutilizables antes que estilos puntuales por pantalla.

## Direccion Estetica

Paleta base recomendada:

- Fondo: piedra calida clara.
- Texto: verde negro muy oscuro.
- Superficies: blanco suave.
- Lineas: arena/gris claro.
- Acento principal: verde esmeralda.
- Acento secundario: oro/cobre para economia.
- Estados:
  - Exito: verde.
  - Advertencia: oro.
  - Error: rojo ladrillo.
  - Informacion: azul petroleo.

La inspiracion Minecraft debe aparecer en:

- Grillas sutiles.
- Bordes rectos o radio pequeno.
- Texturas muy discretas.
- Iconografia de mapa, edificio, monedas, martillo, escudo y campana.
- Ilustraciones o imagenes reales del Realm cuando existan.

## Componentes Base

Crear componentes reutilizables antes de crecer pantallas:

- `Button`.
- `IconButton`.
- `Input`.
- `Select`.
- `Textarea`.
- `Checkbox`.
- `Badge`.
- `Tabs`.
- `Dialog`.
- `DropdownMenu`.
- `Toast`.
- `Table`.
- `DataList`.
- `StatCard`.
- `PropertyCard`.
- `OrganizationCard`.
- `ForumPostCard`.
- `WalletBalance`.
- `NotificationItem`.
- `EmptyState`.
- `PageHeader`.
- `SectionHeader`.

## Librerias Permitidas

Como no usaremos Tailwind en la primera version, las librerias deben convivir bien con CSS Modules.

Recomendadas:

- `lucide-react`: iconos.
- `@radix-ui/react-*`: primitivas accesibles para dialogos, menus, tabs y tooltips.
- `framer-motion`: animaciones pequenas y controladas.
- `react-hook-form`: formularios.
- `zod`: validacion de datos.
- `recharts`: graficas y reportes.
- `date-fns`: fechas.

Regla: no agregar librerias visuales grandes si solo se necesita un componente pequeno.

## CSS Y Arquitectura De Estilos

- Usar CSS Modules por componente.
- Usar variables globales en `app/globals.css`.
- Evitar clases globales salvo tokens, reset y utilidades muy basicas.
- Evitar estilos inline salvo valores calculados dinamicamente.
- Mantener componentes con dimensiones estables para evitar saltos visuales.
- Usar `rem`, `px` y `clamp()` con moderacion.
- No escalar tipografia con viewport width salvo heroes muy controlados.
- Mantener letter spacing en `0`.
- Componentes tipo card con radio maximo de `8px`.

## Buenas Practicas UI

- Botones de accion con icono cuando el significado sea comun.
- Tooltips para iconos no obvios.
- Estados claros: loading, empty, error, disabled y success.
- Tablas para datos administrativos.
- Cards para elementos repetidos como propiedades, publicaciones u organizaciones.
- No poner cards dentro de cards.
- Formularios cortos, agrupados por contexto.
- Modales solo para decisiones acotadas.
- Confirmaciones para transferencias, ventas, multas y acciones irreversibles.

## Accesibilidad

- Contraste suficiente en texto y botones.
- Labels visibles en formularios.
- Foco visible.
- Navegacion por teclado en menus, dialogos y tabs.
- No depender solo del color para estados economicos.
- Textos alternativos en imagenes de construcciones.

## Rendimiento

- Paginacion en foro, propiedades y transacciones.
- Imagenes optimizadas y tamanos definidos.
- Componentes de servidor por defecto en Next.js.
- Componentes cliente solo cuando haya interactividad real.
- Evitar dependencias grandes en rutas publicas.
- Cargar graficas y modales pesados bajo demanda.

## Tono De Producto

La app debe sentirse como una herramienta civica y economica dentro de una ciudad ficticia:

- Seria pero divertida.
- Transparente.
- Ordenada.
- Con sensacion de progreso.
- Cercana al mundo del Realm sin parecer una copia del juego.
