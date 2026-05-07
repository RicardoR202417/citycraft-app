import { ArrowLeft, Building2, CalendarDays, ImageIcon, MapPinned, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader } from "../../components/ui";
import { getPublicConstructionFeed } from "../../lib/constructions/publicFeed";
import styles from "./page.module.css";

export const metadata = {
  title: "Construcciones publicas - CityCraft App"
};

export const revalidate = 60;

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function getPageNumber(value) {
  const page = Number(value);

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function PublicConstructionsPage({ searchParams }) {
  const params = await searchParams;
  const requestedPage = getPageNumber(params?.page);
  const feed = await getPublicConstructionFeed(requestedPage);
  const hasPreviousPage = feed.currentPage > 1;
  const hasNextPage = feed.currentPage < feed.totalPages;

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <div className={styles.headerActions}>
            <LinkButton href="/" icon={ArrowLeft} variant="secondary">
              Inicio
            </LinkButton>
            <LinkButton href="/constructions/new" icon={Plus}>
              Publicar
            </LinkButton>
          </div>
        }
        description="Explora construcciones que los jugadores han decidido publicar para mostrar el crecimiento de la ciudad."
        eyebrow="Exposicion publica"
        title="Construcciones de CityCraft"
      />

      <section className={styles.summary}>
        <Card className={styles.summaryCard}>
          <Building2 size={22} />
          <strong>{feed.total.toLocaleString("es-MX")}</strong>
          <span>publicaciones visibles</span>
        </Card>
        <Card className={styles.summaryCard}>
          <MapPinned size={22} />
          <strong>{feed.currentPage.toLocaleString("es-MX")}</strong>
          <span>pagina actual</span>
        </Card>
      </section>

      <section className={styles.feedSection}>
        <SectionHeader
          description="El feed solo muestra publicaciones marcadas como publicas. Las imagenes privadas no se exponen automaticamente."
          eyebrow="Foro publico"
          title="Ultimas construcciones"
        />

        {feed.posts.length ? (
          <div className={styles.grid}>
            {feed.posts.map((post) => (
              <article className={styles.postCard} key={post.id}>
                <div className={styles.cover}>
                  {post.cover_image_url ? (
                    <Image
                      alt={`Imagen de ${post.title}`}
                      fill
                      sizes="(max-width: 680px) 100vw, (max-width: 1060px) 50vw, 33vw"
                      src={post.cover_image_url}
                    />
                  ) : (
                    <div className={styles.coverFallback}>
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>

                <div className={styles.postBody}>
                  <div className={styles.postMeta}>
                    <Badge tone="success">{post.district_name || "Ciudad"}</Badge>
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(post.published_at)}
                    </span>
                  </div>

                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>

                  <div className={styles.authorLine}>
                    <span aria-hidden="true">{post.author_name.slice(0, 1).toUpperCase()}</span>
                    <strong>{post.author_name}</strong>
                  </div>

                  {post.property_name ? <small>{post.property_name}</small> : null}

                  <Link className={styles.detailLink} href={`/constructions/${post.slug}`}>
                    Ver detalle y comentarios
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Card className={styles.emptyCard}>
            <EmptyState
              description="Cuando los jugadores publiquen construcciones visibles para visitantes, apareceran aqui con imagen, titulo y autor."
              icon={ImageIcon}
              title="Aun no hay construcciones publicas"
            />
          </Card>
        )}
      </section>

      <nav aria-label="Paginacion de construcciones" className={styles.pagination}>
        {hasPreviousPage ? (
          <Link href={`/constructions?page=${feed.currentPage - 1}`}>Anterior</Link>
        ) : (
          <span>Anterior</span>
        )}
        <strong>
          Pagina {feed.currentPage.toLocaleString("es-MX")} de {feed.totalPages.toLocaleString("es-MX")}
        </strong>
        {hasNextPage ? (
          <Link href={`/constructions?page=${feed.currentPage + 1}`}>Siguiente</Link>
        ) : (
          <span>Siguiente</span>
        )}
      </nav>
    </main>
  );
}
