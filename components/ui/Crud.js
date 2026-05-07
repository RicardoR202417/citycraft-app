import { Search } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { LinkButton } from "./LinkButton";
import styles from "./Crud.module.css";

export function CrudLayout({ children, className = "" }) {
  return <div className={[styles.layout, className].filter(Boolean).join(" ")}>{children}</div>;
}

export function CrudWorkspace({ children, sidebar }) {
  return (
    <div className={sidebar ? styles.workspaceWithSidebar : styles.workspace}>
      <div className={styles.mainPanel}>{children}</div>
      {sidebar ? <aside className={styles.sidebar}>{sidebar}</aside> : null}
    </div>
  );
}

export function CrudToolbar({
  actions,
  filters = [],
  method = "get",
  searchDefaultValue = "",
  searchLabel = "Buscar",
  searchName = "q",
  searchPlaceholder = "Buscar"
}) {
  return (
    <Card className={styles.toolbar}>
      <form className={styles.filterForm} method={method}>
        <label className={styles.searchField}>
          <span>{searchLabel}</span>
          <div>
            <Search aria-hidden="true" size={16} />
            <input
              defaultValue={searchDefaultValue}
              name={searchName}
              placeholder={searchPlaceholder}
              type="search"
            />
          </div>
        </label>

        {filters.map((filter) => (
          <label className={styles.filterField} key={filter.name}>
            <span>{filter.label}</span>
            <select defaultValue={filter.defaultValue || ""} name={filter.name}>
              {(filter.options || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <Button size="sm" type="submit" variant="secondary">
          Aplicar
        </Button>
      </form>

      {actions ? <div className={styles.toolbarActions}>{actions}</div> : null}
    </Card>
  );
}

export function CrudActionList({ actions = [], align = "end", "aria-label": ariaLabel = "Acciones" }) {
  if (!actions.length) {
    return null;
  }

  return (
    <div aria-label={ariaLabel} className={[styles.actionList, styles[align]].filter(Boolean).join(" ")}>
      {actions.map((action) => {
        if (action.element) {
          return <div key={action.key || action.label}>{action.element}</div>;
        }

        if (action.href) {
          return (
            <LinkButton
              href={action.href}
              icon={action.icon}
              key={action.key || action.href}
              size={action.size || "sm"}
              variant={action.variant || "secondary"}
            >
              {action.label}
            </LinkButton>
          );
        }

        return (
          <Button
            disabled={action.disabled}
            icon={action.icon}
            key={action.key || action.label}
            name={action.name}
            size={action.size || "sm"}
            type={action.type || "button"}
            value={action.value}
            variant={action.variant || "secondary"}
          >
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}

export function CrudPanel({ children, className = "", title }) {
  return (
    <Card className={[styles.panel, className].filter(Boolean).join(" ")}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </Card>
  );
}
