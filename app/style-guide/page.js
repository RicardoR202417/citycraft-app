import {
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Eye,
  Gavel,
  LandPlot,
  Landmark,
  MapPinned,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  Store,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { ToastDemo } from "../components/ToastDemo";
import styles from "./page.module.css";

const swatches = [
  ["Fondo", "var(--background)", "#f2f4ef"],
  ["Superficie", "var(--surface)", "#ffffff"],
  ["Linea", "var(--line)", "#cbd4c8"],
  ["Acento musgo", "var(--accent)", "#557a62"],
  ["Detalle laton", "var(--detail)", "#927544"],
  ["Peligro ladrillo", "var(--danger)", "#994d44"]
];

const properties = [
  ["Torre Prado", "Corporativo", "Distrito Central", "₵1,420,000"],
  ["Mercado Norte", "Local", "Barrio Roble", "₵680,000"],
  ["Avenida Lineal", "Infraestructura", "Eje Sur", "₵2,100,000"]
];

const ledger = [
  ["Asistencia validada", "+₵18,200", "Jugador"],
  ["Impuesto por transferencia", "+₵3,400", "Gobierno"],
  ["Oferta enviada", "-₵72,000", "Organizacion"]
];

const forumPosts = [
  [
    "Nuevo centro cultural",
    "Apertura de una biblioteca publica con salas de exposicion.",
    "Cultural",
    "18 comentarios"
  ],
  [
    "Subasta: Local 3B",
    "La organizacion Horizonte Urbano puso en venta una unidad comercial.",
    "Mercado",
    "7 pujas"
  ],
  [
    "Avance de avenida",
    "Se terminaron 640 bloques de vialidad conectando dos delegaciones.",
    "Infraestructura",
    "42 vistas"
  ]
];

const propertyFacts = [
  ["Tipo", "Corporativo"],
  ["Delegacion", "Distrito Central"],
  ["Tamano", "3,820 bloques"],
  ["Plusvalia", "+2.4% estable"]
];

export default function StyleGuidePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>CCAPP-15 Guia visual inicial</p>
          <h1>CityCraft App visual direction</h1>
          <p>
            Una interfaz sobria para economia, propiedades y gobierno del Realm:
            modular, clara, con referencias sutiles a materiales, mapas y
            construccion sin caer en una estetica caricaturesca.
          </p>
        </div>
        <div className={styles.heroStats} aria-label="Resumen visual">
          <span>Estilo</span>
          <strong>Stone civic UI</strong>
          <small>Minimalista, monocromatico y responsive.</small>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Paleta y tono</h2>
          <p>
            Base piedra y musgo con detalles de laton para economia. El color
            no domina la interfaz: guia estados, jerarquia y acciones.
          </p>
        </div>
        <div className={styles.swatches}>
          {swatches.map(([name, token, value]) => (
            <article className={styles.swatch} key={name}>
              <div style={{ background: token }} />
              <strong>{name}</strong>
              <span>{value}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.layoutGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Registro inmobiliario</p>
              <h2>Propiedades destacadas</h2>
            </div>
            <MapPinned size={20} />
          </div>
          <div className={styles.propertyList}>
            {properties.map(([name, type, district, value]) => (
              <div className={styles.propertyRow} key={name}>
                <LandPlot size={18} />
                <div>
                  <strong>{name}</strong>
                  <span>
                    {type} / {district}
                  </span>
                </div>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Gobierno</p>
              <h2>Actividad economica</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className={styles.statGrid}>
            <div>
              <Banknote size={18} />
              <strong>₵4.8M</strong>
              <span>Fondos publicos</span>
            </div>
            <div>
              <Building2 size={18} />
              <strong>127</strong>
              <span>Propiedades</span>
            </div>
            <div>
              <UsersRound size={18} />
              <strong>18</strong>
              <span>Jugadores</span>
            </div>
          </div>
          <div className={styles.ledgerList}>
            {ledger.map(([name, amount, actor]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{amount}</strong>
                <small>{actor}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Componentes base</h2>
          <p>
            Bordes discretos, radios chicos, iconos funcionales y densidad
            suficiente para trabajar desde escritorio o movil.
          </p>
        </div>
        <div className={styles.componentGrid}>
          <button className={styles.primaryButton} type="button">
            <CheckCircle2 size={16} />
            Aprobar construccion
          </button>
          <button className={styles.secondaryButton} type="button">
            <Gavel size={16} />
            Crear subasta
          </button>
          <span className={styles.badge}>Plusvalia estable</span>
          <span className={styles.warningBadge}>
            <CircleAlert size={14} />
            Revision requerida
          </span>
          <div className={styles.notification}>
            <Bell size={18} />
            <div>
              <strong>Oferta recibida</strong>
              <span>Un jugador propuso comprar el 35% de Mercado Norte.</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Sileo en vivo</h2>
          <p>
            Las alertas y notificaciones usaran Sileo con tema del sistema,
            radio de 8px y colores conectados a los tokens globales.
          </p>
        </div>
        <ToastDemo />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Graficas y reportes</h2>
          <p>
            Los reportes deben sentirse administrativos, no decorativos. La
            informacion visual se apoya en barras, tendencias y etiquetas
            claras para plusvalia, valor acumulado y actividad.
          </p>
        </div>
        <div className={styles.analyticsGrid}>
          <article className={styles.chartPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Plusvalia</p>
                <h3>Tendencia por delegacion</h3>
              </div>
              <TrendingUp size={20} />
            </div>
            <div className={styles.lineChart} aria-label="Grafica de tendencia">
              <svg viewBox="0 0 640 260" role="img">
                <title>Plusvalia mensual de Distrito Central</title>
                <g className={styles.gridLines}>
                  <line x1="54" y1="36" x2="610" y2="36" />
                  <line x1="54" y1="88" x2="610" y2="88" />
                  <line x1="54" y1="140" x2="610" y2="140" />
                  <line x1="54" y1="192" x2="610" y2="192" />
                  <line x1="54" y1="224" x2="610" y2="224" />
                </g>
                <g className={styles.axisLabels}>
                  <text x="10" y="40">+4%</text>
                  <text x="10" y="92">+3%</text>
                  <text x="10" y="144">+2%</text>
                  <text x="10" y="196">+1%</text>
                  <text x="10" y="228">0%</text>
                </g>
                <polyline
                  className={styles.chartArea}
                  points="54,206 146,182 238,190 330,138 422,112 514,82 610,96 610,224 54,224"
                />
                <polyline
                  className={styles.chartLine}
                  points="54,206 146,182 238,190 330,138 422,112 514,82 610,96"
                />
                <g className={styles.chartDots}>
                  <circle cx="54" cy="206" r="4" />
                  <circle cx="146" cy="182" r="4" />
                  <circle cx="238" cy="190" r="4" />
                  <circle cx="330" cy="138" r="4" />
                  <circle cx="422" cy="112" r="4" />
                  <circle cx="514" cy="82" r="4" />
                  <circle cx="610" cy="96" r="4" />
                </g>
              </svg>
            </div>
            <div className={styles.chartLegend}>
              <span>Distrito Central / ultimos 7 periodos</span>
              <strong>+2.4% actual</strong>
            </div>
          </article>

          <article className={styles.chartPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Valor urbano</p>
                <h3>Valor acumulado</h3>
              </div>
              <Landmark size={20} />
            </div>
            <div className={styles.financeChart} aria-label="Grafica financiera">
              <svg viewBox="0 0 640 260" role="img">
                <title>Valor acumulado por actividad economica</title>
                <g className={styles.gridLines}>
                  <line x1="64" y1="36" x2="610" y2="36" />
                  <line x1="64" y1="88" x2="610" y2="88" />
                  <line x1="64" y1="140" x2="610" y2="140" />
                  <line x1="64" y1="192" x2="610" y2="192" />
                  <line x1="64" y1="224" x2="610" y2="224" />
                </g>
                <g className={styles.axisLabels}>
                  <text x="8" y="40">₵5M</text>
                  <text x="8" y="92">₵4M</text>
                  <text x="8" y="144">₵3M</text>
                  <text x="8" y="196">₵2M</text>
                  <text x="8" y="228">₵1M</text>
                </g>
                <polyline
                  className={styles.chartLine}
                  points="64,196 155,178 246,152 337,126 428,104 519,84 610,62"
                />
                <polyline
                  className={styles.chartLineAlt}
                  points="64,214 155,206 246,192 337,170 428,158 519,136 610,124"
                />
                <g className={styles.chartDots}>
                  <circle cx="64" cy="196" r="4" />
                  <circle cx="155" cy="178" r="4" />
                  <circle cx="246" cy="152" r="4" />
                  <circle cx="337" cy="126" r="4" />
                  <circle cx="428" cy="104" r="4" />
                  <circle cx="519" cy="84" r="4" />
                  <circle cx="610" cy="62" r="4" />
                </g>
              </svg>
            </div>
            <div className={styles.financialSummary}>
              <div>
                <span>Valor total</span>
                <strong>₵8.9M</strong>
              </div>
              <div>
                <span>Crecimiento</span>
                <strong>+₵420K</strong>
              </div>
              <div>
                <span>Mayor zona</span>
                <strong>Centro</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.layoutGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Foro publico</p>
              <h2>Feed de ciudad</h2>
            </div>
            <MessageSquareText size={20} />
          </div>
          <div className={styles.forumList}>
            {forumPosts.map(([title, summary, badge, meta]) => (
              <article className={styles.forumPost} key={title}>
                <div className={styles.postImage} aria-hidden="true">
                  <Store size={22} />
                </div>
                <div>
                  <span>{badge}</span>
                  <h3>{title}</h3>
                  <p>{summary}</p>
                  <small>
                    <Eye size={13} />
                    {meta}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Detalle de propiedad</p>
              <h2>Torre Prado</h2>
            </div>
            <LandPlot size={20} />
          </div>
          <div className={styles.propertyHero}>
            <Building2 size={42} />
            <div>
              <strong>₵1,420,000</strong>
              <span>Valor actualizado por plusvalia y tipo corporativo.</span>
            </div>
          </div>
          <div className={styles.factGrid}>
            {propertyFacts.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className={styles.ownerList}>
            <div>
              <UsersRound size={16} />
              <span>Horizonte Urbano</span>
              <strong>60%</strong>
            </div>
            <div>
              <UsersRound size={16} />
              <span>RicardoR</span>
              <strong>40%</strong>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Estados de sistema</h2>
          <p>
            Las alertas de operaciones economicas deben ser legibles, directas
            y con icono. La bandeja conserva historial; Sileo avisa eventos
            inmediatos.
          </p>
        </div>
        <div className={styles.statusGrid}>
          <article>
            <CheckCircle2 size={18} />
            <strong>Pago procesado</strong>
            <span>Se registraron movimientos en ledger.</span>
          </article>
          <article>
            <CalendarDays size={18} />
            <strong>Asistencia pendiente</strong>
            <span>El gobierno debe validar 30 min de juego.</span>
          </article>
          <article>
            <ReceiptText size={18} />
            <strong>Impuesto aplicado</strong>
            <span>Transferencia mayor con comision al gobierno.</span>
          </article>
          <article>
            <CircleAlert size={18} />
            <strong>Saldo insuficiente</strong>
            <span>La operacion no puede finalizarse.</span>
          </article>
        </div>
      </section>
    </main>
  );
}
