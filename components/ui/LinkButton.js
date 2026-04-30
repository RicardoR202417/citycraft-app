import Link from "next/link";
import styles from "./Button.module.css";

export function LinkButton({
  children,
  href,
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
    <Link className={classes} href={href} {...props}>
      {Icon ? <Icon aria-hidden="true" size={16} /> : null}
      <span>{children}</span>
    </Link>
  );
}
