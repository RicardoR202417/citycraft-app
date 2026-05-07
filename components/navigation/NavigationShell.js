"use client";

import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./NavigationShell.module.css";

export function NavigationShell({ isAuthenticated, links, profileLabel }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
          pathname={pathname}
          profileLabel={profileLabel}
        />
      </aside>
    </>
  );
}

function NavigationContent({ isAuthenticated, isCollapsed = false, links, onNavigate, pathname, profileLabel }) {
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
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(`${link.href}/`));

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`${styles.navLink} ${isActive ? styles.active : ""}`}
              href={link.href}
              key={link.href}
              onClick={onNavigate}
              title={isCollapsed ? link.label : undefined}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
