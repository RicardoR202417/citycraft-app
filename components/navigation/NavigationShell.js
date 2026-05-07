"use client";

import {
  Archive,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Gavel,
  Home,
  Landmark,
  LayoutDashboard,
  LogIn,
  MapPinned,
  Menu,
  Moon,
  Shield,
  Store,
  Sun,
  UserCircle,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./NavigationShell.module.css";

const THEME_STORAGE_KEY = "citycraft-theme";
const ICONS = {
  archive: Archive,
  bell: Bell,
  building: Building2,
  clipboard: ClipboardCheck,
  dashboard: LayoutDashboard,
  gavel: Gavel,
  home: Home,
  landmark: Landmark,
  login: LogIn,
  map: MapPinned,
  money: CircleDollarSign,
  shield: Shield,
  store: Store,
  user: UserCircle,
  users: Users
};
const THEME_OPTIONS = [
  { label: "Sistema", value: "system" },
  { icon: Sun, label: "Claro", value: "light" },
  { icon: Moon, label: "Oscuro", value: "dark" }
];

export function NavigationShell({ isAuthenticated, links, profileLabel }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  return (
    <>
      <button
        aria-controls="citycraft-mobile-navigation"
        aria-expanded={isDrawerOpen}
        aria-label="Abrir navegacion"
        className={styles.mobileToggle}
        onClick={() => setIsDrawerOpen(true)}
        type="button"
      >
        <Menu size={20} />
      </button>

      <aside className={`${styles.desktopNav} ${isCollapsed ? styles.collapsed : ""}`} aria-label="Navegacion principal">
        <NavigationContent
          isAuthenticated={isAuthenticated}
          isCollapsed={isCollapsed}
          links={links}
          onToggleGroup={(key) => setOpenGroups((groups) => ({ ...groups, [key]: !groups[key] }))}
          openGroups={openGroups}
          pathname={pathname}
          profileLabel={profileLabel}
        />
        <button
          aria-label={isCollapsed ? "Expandir navegacion" : "Contraer navegacion"}
          className={styles.collapseButton}
          onClick={() => setIsCollapsed((value) => !value)}
          type="button"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      <div
        className={`${styles.drawerBackdrop} ${isDrawerOpen ? styles.drawerBackdropOpen : ""}`}
        onClick={() => setIsDrawerOpen(false)}
      />
      <aside
        aria-label="Navegacion movil"
        className={`${styles.mobileDrawer} ${isDrawerOpen ? styles.mobileDrawerOpen : ""}`}
        id="citycraft-mobile-navigation"
      >
        <button
          aria-label="Cerrar navegacion"
          className={styles.closeButton}
          onClick={() => setIsDrawerOpen(false)}
          type="button"
        >
          <X size={18} />
        </button>
        <NavigationContent
          isAuthenticated={isAuthenticated}
          links={links}
          onNavigate={() => setIsDrawerOpen(false)}
          onToggleGroup={(key) => setOpenGroups((groups) => ({ ...groups, [key]: !groups[key] }))}
          openGroups={openGroups}
          pathname={pathname}
          profileLabel={profileLabel}
        />
      </aside>
    </>
  );
}

function NavigationContent({
  isAuthenticated,
  isCollapsed = false,
  links,
  onNavigate,
  onToggleGroup,
  openGroups,
  pathname,
  profileLabel
}) {
  return (
    <nav className={styles.navInner}>
      <Link className={styles.brand} href="/">
        <span aria-hidden="true">C</span>
        <strong>CityCraft</strong>
      </Link>

      <div className={styles.profileBlock}>
        <small>{isAuthenticated ? "Sesion activa" : "Modo publico"}</small>
        <strong>{profileLabel}</strong>
      </div>

      <div className={styles.linkList}>
        {links.map((link) => (
          <NavigationItem
            isCollapsed={isCollapsed}
            item={link}
            key={link.href || link.key}
            onNavigate={onNavigate}
            onToggleGroup={onToggleGroup}
            openGroups={openGroups}
            pathname={pathname}
          />
        ))}
      </div>

      <ThemeControl />
    </nav>
  );
}

function ThemeControl() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <section className={styles.themeControl} suppressHydrationWarning>
      <small>Tema</small>
      <div className={styles.themeOptions}>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = theme === option.value;

          return (
            <button
              aria-pressed={isActive}
              className={isActive ? styles.themeOptionActive : ""}
              key={option.value}
              onClick={() => setTheme(option.value)}
              title={option.label}
              type="button"
            >
              {Icon ? <Icon aria-hidden="true" size={14} /> : null}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NavigationItem({ isCollapsed, item, onNavigate, onToggleGroup, openGroups, pathname }) {
  const hasChildren = Boolean(item.children?.length);

  if (hasChildren) {
    const groupKey = item.key || item.label;
    const hasActiveChild = item.children.some((child) => isPathActive(pathname, child.href));
    const isOpen = openGroups[groupKey] ?? hasActiveChild;

    return (
      <div className={styles.navGroup}>
        <button
          aria-expanded={isOpen}
          className={`${styles.navLink} ${styles.groupButton} ${hasActiveChild ? styles.active : ""}`}
          onClick={() => onToggleGroup(groupKey)}
          title={isCollapsed ? item.label : undefined}
          type="button"
        >
          <NavigationIcon name={item.icon} size={18} />
          <span>{item.label}</span>
          <ChevronDown aria-hidden="true" className={isOpen ? styles.chevronOpen : ""} size={16} />
        </button>

        {isOpen && !isCollapsed ? (
          <div className={styles.submenu}>
            {item.children.map((child) => {
              const isActive = isPathActive(pathname, child.href);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`${styles.submenuLink} ${isActive ? styles.active : ""}`}
                  href={child.href}
                  key={child.href}
                  onClick={onNavigate}
                >
                  <NavigationIcon name={child.icon} size={15} />
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  const isActive = isPathActive(pathname, item.href);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`${styles.navLink} ${isActive ? styles.active : ""}`}
      href={item.href}
      onClick={onNavigate}
      title={isCollapsed ? item.label : undefined}
    >
      <NavigationIcon name={item.icon} size={18} />
      <span>{item.label}</span>
    </Link>
  );
}

function isPathActive(pathname, href) {
  return pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));
}

function NavigationIcon({ name, size }) {
  const Icon = ICONS[name] || Home;
  return <Icon aria-hidden="true" size={size} />;
}

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
}

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }

  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return;
  }

  document.documentElement.removeAttribute("data-theme");
  window.localStorage.removeItem(THEME_STORAGE_KEY);
}
