import styles from "./Badge.module.css";

export function Badge({ children, tone = "neutral", className = "" }) {
  const classes = [styles.badge, styles[tone], className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
