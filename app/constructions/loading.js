import styles from "./loading.module.css";

export default function PublicConstructionsLoading() {
  return (
    <main className={styles.page} aria-label="Cargando construcciones publicas">
      <div className={styles.headerSkeleton} />
      <section className={styles.summary}>
        <div />
        <div />
      </section>
      <section className={styles.grid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <article className={styles.card} key={index}>
            <div className={styles.cover} />
            <div className={styles.lines}>
              <span />
              <strong />
              <p />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
