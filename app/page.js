import Link from "next/link";
import styles from "./page.module.css";

const modules = [
  {
    description: "Feed abierto para mostrar construcciones publicas del Realm.",
    href: "/constructions",
    title: "Foro publico"
  },
  {
    description: "Propiedades, delegaciones, valores y propietarios auditables.",
    href: "/login",
    title: "Registro inmobiliario"
  },
  {
    description: "Sociedades privadas, porcentajes y patrimonio compartido.",
    href: "/login",
    title: "Organizaciones"
  },
  {
    description: "Transparencia, tierras, multas, permisos y acciones publicas.",
    href: "/transparency/government",
    title: "Gobierno"
  },
  {
    description: "Ventas, ofertas y subastas futuras para mover la economia.",
    href: "/login",
    title: "Mercado"
  },
  {
    description: "Pujas por tiempo y cierres atomicos de propiedades.",
    href: "/login",
    title: "Subastas"
  },
  {
    description: "Registro gubernamental de asistencia y pagos diarios.",
    href: "/login",
    title: "Asistencia"
  },
  {
    description: "Indices por delegacion para entender el valor de cada zona.",
    href: "/login",
    title: "Plusvalia"
  }
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>Minecraft Bedrock Realm</p>
          <h1>CityCraft App</h1>
          <p className={styles.heroDescription}>
            Plataforma open source para mostrar la ciudad, administrar
            propiedades ficticias, registrar asistencias y dar vida a una
            economia creativa entre jugadores.
          </p>
          <div className={styles.heroActions}>
            <Link href="/constructions">Ver construcciones</Link>
            <Link href="/transparency/government">Ver gobierno</Link>
            <Link href="/login">Iniciar sesion</Link>
          </div>
        </div>

        <div className={styles.panel} aria-label="Resumen del sistema">
          <span>Stack inicial</span>
          <strong>Next.js + Supabase</strong>
          <p>JavaScript, CSS Modules, PostgreSQL, Auth, Storage y Realtime.</p>
        </div>
      </section>

      <section className={styles.grid} aria-label="Modulos principales">
        {modules.map((module) => (
          <article className={styles.card} key={module.title}>
            <h2>{module.title}</h2>
            <p>{module.description}</p>
            <Link href={module.href}>Abrir</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
