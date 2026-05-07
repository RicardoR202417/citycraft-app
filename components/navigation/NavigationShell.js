"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./NavigationShell.module.css";

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
    </nav>
  );
}

function NavigationItem({ isCollapsed, item, onNavigate, onToggleGroup, openGroups, pathname }) {
  const Icon = item.icon;
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
          <Icon aria-hidden="true" size={18} />
          <span>{item.label}</span>
          <ChevronDown aria-hidden="true" className={isOpen ? styles.chevronOpen : ""} size={16} />
        </button>

        {isOpen && !isCollapsed ? (
          <div className={styles.submenu}>
            {item.children.map((child) => {
              const ChildIcon = child.icon;
              const isActive = isPathActive(pathname, child.href);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`${styles.submenuLink} ${isActive ? styles.active : ""}`}
                  href={child.href}
                  key={child.href}
                  onClick={onNavigate}
                >
                  <ChildIcon aria-hidden="true" size={15} />
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
      <Icon aria-hidden="true" size={18} />
      <span>{item.label}</span>
    </Link>
  );
}

function isPathActive(pathname, href) {
  return pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));
}
