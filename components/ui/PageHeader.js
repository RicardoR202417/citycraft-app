import styles from "./PageHeader.module.css";

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className={styles.header}>
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <span>{description}</span> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
