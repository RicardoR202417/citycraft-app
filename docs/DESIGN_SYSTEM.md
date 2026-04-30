# Design System - CityCraft App

## Objetivo

Definir una guia visual para `CCAPP-15` que permita construir una interfaz
minimalista, moderna y consistente para CityCraft App. La direccion debe
recordar el mundo de Minecraft Bedrock de forma sutil: ciudad, mapas,
materiales, economia y construccion. No debe sentirse caricaturesca ni como una
copia de la interfaz del videojuego.

## Personalidad Visual

CityCraft App debe sentirse como una herramienta civica y economica de una
ciudad ficticia:

- Sobria, clara y ordenada.
- Inspirada en materiales del mundo: piedra, musgo, madera oscura, laton y
  trazos de mapa.
- Con detalles geometricos discretos que recuerden bloques o parcelas.
- Preparada para trabajo frecuente en escritorio y consulta rapida en movil.
- Transparente y confiable para economia, gobierno y propiedad.

La referencia conceptual es `Stone civic UI`: una interfaz de administracion
urbana con acentos del Realm, no una UI de arcade.

## Paleta

La paleta sera casi monocromatica. La base se construye sobre piedra neutra,
verde musgo apagado y detalles de laton para economia. Los colores fuertes se
reservan para estados y alertas.

### Tema Claro

| Token | Uso | Valor inicial |
| --- | --- | --- |
| `--background` | Fondo general | `#f2f4ef` |
| `--foreground` | Texto principal | `#171c18` |
| `--muted` | Texto secundario | `#5f695f` |
| `--surface` | Paneles y cards | `#ffffff` |
| `--surface-subtle` | Filas, bloques, superficies suaves | `#e7ebe3` |
| `--surface-strong` | Superficies elevadas o agrupadas | `#dce3d9` |
| `--line` | Bordes | `#cbd4c8` |
| `--accent` | Acento funcional | `#557a62` |
| `--accent-strong` | Acciones primarias | `#315d46` |
| `--detail` | Economia, valor, informacion destacada | `#927544` |
| `--danger` | Errores y acciones destructivas | `#994d44` |
| `--info` | Informacion del sistema | `#55727a` |
| `--toast-fill` | Notificaciones Sileo | `#26392f` |
| `--toast-title` | Texto principal de Sileo | `#f7fbf4` |
| `--toast-description` | Texto secundario de Sileo | `#d9e5da` |

### Tema Oscuro

El tema oscuro mantiene la identidad y solo cambia contraste, superficies y
profundidad. El acento no debe volverse neon.

| Token | Uso | Valor inicial |
| --- | --- | --- |
| `--background` | Fondo general | `#101411` |
| `--foreground` | Texto principal | `#edf2ec` |
| `--muted` | Texto secundario | `#a8b3a8` |
| `--surface` | Paneles y cards | `#171d19` |
| `--surface-subtle` | Filas, bloques, superficies suaves | `#202821` |
| `--surface-strong` | Superficies elevadas o agrupadas | `#293329` |
| `--line` | Bordes | `#344037` |
| `--accent` | Acento funcional | `#82aa8e` |
| `--accent-strong` | Acciones primarias | `#a8c7ae` |
| `--detail` | Economia, valor, informacion destacada | `#c7a866` |
| `--danger` | Errores y acciones destructivas | `#d28a80` |
| `--info` | Informacion del sistema | `#8fb4bd` |
| `--toast-fill` | Notificaciones Sileo | `#eef3ed` |
| `--toast-title` | Texto principal de Sileo | `#101411` |
| `--toast-description` | Texto secundario de Sileo | `#334033` |

## Moneda

Usar el simbolo `₵` para cantidades de dinero ficticio dentro de la interfaz.

Ejemplos:

- `₵1,420,000`
- `+₵18,200`
- `-₵72,000`

Evitar sufijos largos como `CC` dentro de tarjetas, tablas o notificaciones,
porque hacen que las cantidades se vean menos financieras.

## Tipografia

La tipografia debe ser legible antes que decorativa.

- Texto normal: `Inter`, `Segoe UI`, `Arial`, `Helvetica`, `sans-serif`.
- Titulos y numeros grandes: `Space Grotesk`, `Inter`, `Segoe UI`,
  `sans-serif`.
- Letter spacing: `0`.
- Line height recomendado:
  - Texto normal: `1.5` a `1.65`.
  - Titulos: `0.95` a `1.15`.
  - Labels y metadatos: `1.2` a `1.35`.
- Evitar tipografias pixeladas como base. Solo podrian usarse como detalle
  puntual en logotipo o marca si mas adelante se decide.

## Radios, Bordes Y Elevacion

- Radio maximo para cards y paneles: `8px`.
- Botones, badges, inputs y filas: `4px` a `6px`.
- Bordes visibles y finos para separar informacion.
- Sombras suaves, nunca flotantes en exceso.
- Evitar cards dentro de cards. Para agrupar informacion, usar filas,
  secciones o divisores internos.

## Layout Y Responsividad

La app debe funcionar especialmente bien en escritorio y movil.

- Desktop:
  - Ancho maximo recomendado para vistas principales: `1180px`.
  - Usar grids de 2 a 4 columnas para dashboards.
  - Tablas para datos administrativos.
- Movil:
  - Priorizar listas verticales, filtros colapsables y acciones claras.
  - Tablas complejas deben convertirse en listas escaneables.
  - Controles tactiles de al menos `40px` de alto.
- Todas las vistas deben evitar saltos de layout con dimensiones estables.

## Componentes Base

Los componentes deben construirse primero como piezas reutilizables con CSS
Modules.

- `Button` e `IconButton`.
- `Input`, `Select`, `Textarea`, `Checkbox`.
- `Badge` y `StatusPill`.
- `Tabs`.
- `Dialog`.
- `DropdownMenu`.
- `Tooltip`.
- `Toast` usando Sileo.
- `Table`.
- `DataList`.
- `StatCard`.
- `PropertyCard`.
- `OrganizationCard`.
- `ForumPostCard`.
- `WalletBalance`.
- `NotificationItem`.
- `PageHeader`.
- `SectionHeader`.
- `EmptyState`.

## Iconografia

Usar `lucide-react` como base.

Iconos recomendados por modulo:

- Propiedades: `LandPlot`, `Building2`, `MapPinned`.
- Economia: `Banknote`, `Coins`, `ReceiptText`.
- Gobierno: `ShieldCheck`, `Scale`, `FileCheck`.
- Mercado y subastas: `Store`, `Gavel`, `Handshake`.
- Notificaciones: `Bell`, `CircleAlert`, `CheckCircle2`.
- Organizaciones: `UsersRound`, `BriefcaseBusiness`.

Los iconos deben explicar accion o estado. Si el significado no es obvio,
agregar tooltip.

## Notificaciones Con Sileo

Sileo es requisito para alertas y notificaciones en vivo del sistema.

Instalacion:

```bash
npm install sileo
```

Integracion inicial:

- Importar `sileo/styles.css` en el root layout.
- Montar `<Toaster />` una sola vez desde `app/providers.js`.
- Usar `theme="system"` para respetar modo claro/oscuro.
- Configurar `roundness: 8` para alinear con el sistema visual.
- Conectar `fill` a `--toast-fill`.
- Usar `--toast-border`, `--toast-title` y `--toast-description` para asegurar
  contraste propio en modo claro y oscuro.
- Personalizar estados con variables `--sileo-state-*`.

Casos de uso:

- Asistencia registrada.
- Pago diario procesado.
- Nueva oferta o contrapropuesta.
- Puja superada.
- Subasta finalizada.
- Multa del gobierno.
- Transferencia completada.
- Error por saldo insuficiente.

Reglas:

- No saturar con toasts no importantes.
- Usar bandeja de notificaciones para historial.
- Usar toast para eventos inmediatos que requieren atencion.
- No depender solo del color: incluir titulo, descripcion e icono.
- En modo oscuro, las notificaciones no deben usar la misma superficie que las
  cards. Deben tener una superficie clara controlada para conservar lectura y
  presencia visual.
- En modo claro, las notificaciones deben usar una superficie oscura para que
  no se pierdan con las cards blancas.

## Estados

Cada componente importante debe cubrir:

- Default.
- Hover.
- Focus visible.
- Disabled.
- Loading.
- Empty.
- Error.
- Success.
- Pending o en revision.

## Accesibilidad

- Contraste suficiente en texto normal y botones.
- Labels visibles en formularios.
- Foco visible con `:focus-visible`.
- Navegacion por teclado en menus, tabs y dialogos.
- Textos alternativos en imagenes de construcciones.
- Estados economicos con texto, icono y color.

## Rendimiento

- Componentes de servidor por defecto en Next.js.
- Componentes cliente solo para interactividad real.
- Paginacion en foro, propiedades, mercado y ledger.
- Imagenes optimizadas y con dimensiones definidas.
- Carga diferida para graficas, modales complejos y reportes.
- Evitar librerias visuales grandes si un componente propio resuelve el caso.

## Mockup Interno

La ruta `/style-guide` contiene una primera maqueta navegable con:

- Paleta clara/oscura mediante tokens.
- Ejemplos de tarjetas, listados, stats y badges.
- Integracion visual de Sileo.
- Graficas financieras de linea con ejes, etiquetas y resumen numerico.
- Feed de foro publico.
- Vista de detalle de propiedad con propietarios y porcentajes.
- Estados de sistema para pagos, asistencia, impuestos y errores.
- Composicion responsive para escritorio y movil.

Esta pagina sirve como laboratorio visual antes de convertir los patrones en
componentes finales reutilizables.
