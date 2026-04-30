import styles from "./Card.module.css";

export function Card({ children, className = "" }) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
