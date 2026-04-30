import styles from "./EmptyState.module.css";

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className={styles.empty}>
      {Icon ? (
        <span className={styles.icon}>
          <Icon aria-hidden="true" size={22} />
        </span>
      ) : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
