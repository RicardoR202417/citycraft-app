import styles from "./IconButton.module.css";

export function IconButton({
  label,
  icon: Icon,
  variant = "secondary",
  className = "",
  ...props
}) {
  const classes = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button aria-label={label} className={classes} title={label} {...props}>
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}
