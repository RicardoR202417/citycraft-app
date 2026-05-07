import {
  ArrowRight,
  Building2,
  CalendarDays,
  Crown,
  ImageIcon,
  Landmark,
  MapPinned,
  MessageSquareText,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge, Card, EmptyState } from "../components/ui";
import { getPublicConstructionFeed } from "../lib/constructions/publicFeed";
import styles from "./page.module.css";

export const revalidate = 60;

const publicLinks = [
  {
    description: "Construcciones, avances y publicaciones visibles para visitantes.",
    href: "/constructions",
    icon: MessageSquareText,
    title: "Foro publico"
  },
  {
    description: "Informacion abierta del gobierno, patrimonio y movimientos visibles.",
    href: "/transparency/government",
    icon: Landmark,
    title: "Gobierno"
  },
  {
    description: "Registro de zonas para leer como crece cada delegacion.",
    href: "/districts",
    icon: MapPinned,
    title: "Delegaciones"
  }
];

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}

export default async function Home() {
  const feed = await getPublicConstructionFeed(1);
  const featuredPost = feed.posts[0];
  const recentPosts = feed.posts.slice(1, 5);

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Minecraft Bedrock Realm</p>
          <h1 id="home-title">CityCraft App</h1>
          <p className={styles.heroDescription}>
            Un foro publico para ver como evoluciona la ciudad y una plataforma
            privada para administrar propiedades, organizaciones y economia
            entre jugadores.
          </p>

          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/constructions">
              Explorar publicaciones
              <ArrowRight size={18} />
            </Link>
            <Link href="/login">Entrar como jugador</Link>
          </div>
        </div>

        <aside className={styles.cityPanel} aria-label="Actividad publica">
          <span>Foro publico</span>
          <strong>{feed.total.toLocaleString("es-MX")}</strong>
          <p>publicaciones visibles de construcciones, zonas y avances del Realm.</p>
        </aside>
      </section>

      <section className={styles.liveGrid} aria-label="Resumen publico de CityCraft">
        <Card className={styles.metricCard}>
          <Building2 size={22} />
          <strong>Ciudad creativa</strong>
          <span>Propiedades ficticias, proyectos compartidos y valor por zona.</span>
        </Card>
        <Card className={styles.metricCard}>
          <Crown size={22} />
          <strong>Economia viva</strong>
          <span>Ventas, subastas, asistencias y movimientos auditables.</span>
        </Card>
        <Card className={styles.metricCard}>
          <Sparkles size={22} />
          <strong>Identidad sobria</strong>
          <span>Inspirada en el juego sin convertir la interfaz en caricatura.</span>
        </Card>
      </section>

      <section className={styles.feedSection} aria-labelledby="feed-title">
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.kicker}>Actividad reciente</p>
            <h2 id="feed-title">Ultimas publicaciones del foro</h2>
            <p>
              Este es el punto de entrada publico del proyecto. Las publicaciones
              aparecen aqui cuando los jugadores deciden compartirlas con visitantes.
            </p>
          </div>
          <Link href="/constructions">
            Ver todo el foro
            <ArrowRight size={17} />
          </Link>
        </div>

        {featuredPost ? (
          <div className={styles.feedLayout}>
            <article className={styles.featuredPost}>
              <div className={styles.featuredCover}>
                {featuredPost.cover_image_url ? (
                  <Image
                    alt={`Imagen de ${featuredPost.title}`}
                    fill
                    priority
                    quality={76}
                    sizes="(max-width: 980px) 100vw, 54vw"
                    src={featuredPost.cover_image_url}
                  />
                ) : (
                  <div className={styles.coverFallback}>
                    <ImageIcon size={34} />
                  </div>
                )}
              </div>

              <div className={styles.featuredBody}>
                <div className={styles.postMeta}>
                  <Badge tone="success">{featuredPost.district_name || "Ciudad"}</Badge>
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(featuredPost.published_at)}
                  </span>
                </div>
                <h3>{featuredPost.title}</h3>
                <p>{featuredPost.excerpt}</p>
                <div className={styles.authorLine}>
                  <span aria-hidden="true">{featuredPost.author_name.slice(0, 1).toUpperCase()}</span>
                  <strong>{featuredPost.author_name}</strong>
                </div>
                <Link href={`/constructions/${featuredPost.slug}`}>Abrir publicacion</Link>
              </div>
            </article>

            <div className={styles.recentList}>
              {recentPosts.length ? (
                recentPosts.map((post) => (
                  <article className={styles.compactPost} key={post.id}>
                    <div className={styles.compactMeta}>
                      <Badge tone="neutral">{post.district_name || "Ciudad"}</Badge>
                      <span>{formatDate(post.published_at)}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <Link href={`/constructions/${post.slug}`}>Ver detalle</Link>
                  </article>
                ))
              ) : (
                <Card className={styles.emptyRecent}>
                  <EmptyState
                    description="La primera publicacion publica ya aparece destacada. Las siguientes se mostraran aqui como actividad reciente."
                    icon={MessageSquareText}
                    title="Aun no hay mas publicaciones"
                  />
                </Card>
              )}
            </div>
          </div>
        ) : (
          <Card className={styles.emptyCard}>
            <EmptyState
              description="Cuando existan publicaciones publicas, esta pantalla se convertira en el foro principal de visitantes con imagenes, autores y detalles."
              icon={ImageIcon}
              title="Aun no hay publicaciones publicas"
            />
          </Card>
        )}
      </section>

      <section className={styles.publicMap} aria-label="Vistas publicas disponibles">
        {publicLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link className={styles.publicLink} href={item.href} key={item.title}>
              <Icon size={20} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <ArrowRight size={17} />
            </Link>
          );
        })}
      </section>
    </main>
  );
}
