import styles from "./SectionHeader.module.css";

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className={styles.header}>
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <span>{description}</span> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
