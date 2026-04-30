import styles from "./Button.module.css";

export function Button({
  children,
  icon: Icon,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {Icon ? <Icon aria-hidden="true" size={16} /> : null}
      <span>{children}</span>
    </button>
  );
}
