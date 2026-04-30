import styles from "./DataList.module.css";

export function DataList({ items }) {
  return (
    <dl className={styles.list}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
