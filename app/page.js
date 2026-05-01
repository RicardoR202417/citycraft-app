import Link from "next/link";
import styles from "./page.module.css";

const modules = [
  "Foro publico",
  "Registro inmobiliario",
  "Organizaciones",
  "Gobierno",
  "Mercado",
  "Subastas",
  "Asistencia",
  "Plusvalia"
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
          <article className={styles.card} key={module}>
            <h2>{module}</h2>
            <p>
              Modulo planificado en el documento base del proyecto para crecer
              de forma ordenada y auditable.
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
