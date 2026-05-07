import { ArrowLeft, CalendarDays, ImageIcon, LogIn, MessageSquare, UserCircle } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader } from "../../../components/ui";
import { getCurrentProfile } from "../../../lib/auth";
import {
  getPublicConstructionComments,
  getPublicConstructionPostBySlug
} from "../../../lib/constructions/publicFeed";
import { CommentForm } from "./CommentForm";
import { DeleteCommentForm } from "./DeleteCommentForm";
import styles from "./page.module.css";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPublicConstructionPostBySlug(slug);

  return {
    title: post ? `${post.title} - CityCraft App` : "Construccion - CityCraft App"
  };
}

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function ConstructionDetailPage({ params }) {
  const { slug } = await params;
  const [post, profile] = await Promise.all([
    getPublicConstructionPostBySlug(slug),
    getCurrentProfile()
  ]);

  if (!post) {
    notFound();
  }

  const comments = await getPublicConstructionComments(post.id);

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/constructions" icon={ArrowLeft} variant="secondary">
            Construcciones
          </LinkButton>
        }
        description={post.excerpt || "Detalle publico de una construccion del Realm."}
        eyebrow="Publicacion"
        title={post.title}
      />

      <article className={styles.layout}>
        <Card className={styles.postCard}>
          <div className={styles.cover}>
            {post.cover_image_url ? (
              <Image
                alt={`Imagen de ${post.title}`}
                fill
                priority
                sizes="(max-width: 980px) 100vw, 64vw"
                src={post.cover_image_url}
              />
            ) : (
              <div className={styles.coverFallback}>
                <ImageIcon size={34} />
              </div>
            )}
          </div>

          <div className={styles.postBody}>
            <div className={styles.metaLine}>
              <Badge tone="success">{post.district_name || "Ciudad"}</Badge>
              {post.property_name ? <Badge tone="info">{post.property_name}</Badge> : null}
              <span>
                <CalendarDays size={14} />
                {formatDate(post.published_at)}
              </span>
            </div>

            <p>{post.body || post.excerpt}</p>
          </div>
        </Card>

        <aside className={styles.sideCard}>
          <Card className={styles.card}>
            <SectionHeader
              description="Autor visible segun sus preferencias de perfil."
              eyebrow="Autor"
              title={post.author_name}
            />
            <div className={styles.author}>
              <span aria-hidden="true">{post.author_name.slice(0, 1).toUpperCase()}</span>
              <strong>{post.author_name}</strong>
            </div>
          </Card>
        </aside>
      </article>

      <Card className={styles.commentsCard}>
        <SectionHeader
          description="Participacion del foro. Los comentarios se muestran por autor y fecha, y se pueden moderar segun permisos."
          eyebrow="Foro"
          title="Comentarios"
        />

        {profile ? (
          <CommentForm postId={post.id} slug={post.slug} />
        ) : (
          <div className={styles.loginBox}>
            <LogIn size={20} />
            <span>Inicia sesion para comentar esta publicacion.</span>
            <LinkButton href={`/login?next=${encodeURIComponent(`/constructions/${post.slug}`)}`} size="sm">
              Entrar
            </LinkButton>
          </div>
        )}

        {comments.length ? (
          <div className={styles.commentsList}>
            {comments.map((comment) => {
              const canDelete =
                profile?.id === comment.author_profile_id || profile?.id === post.author_profile_id;

              return (
                <article className={styles.comment} key={comment.id}>
                  <div className={styles.commentAvatar}>
                    <UserCircle size={20} />
                  </div>
                  <div className={styles.commentBody}>
                    <header>
                      <strong>{comment.author_name}</strong>
                      <span>{formatDate(comment.created_at)}</span>
                    </header>
                    <p>{comment.body}</p>
                    {canDelete ? <DeleteCommentForm commentId={comment.id} slug={post.slug} /> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description="Cuando los jugadores participen en esta publicacion, sus comentarios apareceran aqui."
            icon={MessageSquare}
            title="Sin comentarios"
          />
        )}
      </Card>
    </main>
  );
}
