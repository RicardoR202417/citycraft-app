import { getCurrentProfile, isGlobalAdmin, isGovernmentMember } from "../../lib/auth";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { NavigationShell } from "./NavigationShell";

export async function GlobalNavigation() {
  const profile = await getCurrentProfile();
  let hasGovernmentAccess = false;
  let hasAdminAccess = false;

  if (profile) {
    const supabase = await createSupabaseServerClient();
    [hasGovernmentAccess, hasAdminAccess] = await Promise.all([
      isGovernmentMember(supabase, profile.id),
      isGlobalAdmin(supabase, profile.id)
    ]);
  }

  const links = [
    { href: "/", icon: "home", label: "Foro" },
    { href: "/constructions", icon: "building", label: "Construcciones" },
    { href: "/districts", icon: "map", label: "Delegaciones", requiresAuth: true },
    { href: "/properties", icon: "landmark", label: "Propiedades", requiresAuth: true },
    { href: "/market", icon: "store", label: "Mercado", requiresAuth: true },
    { href: "/auctions", icon: "gavel", label: "Subastas", requiresAuth: true },
    { href: "/organizations", icon: "money", label: "Organizaciones", requiresAuth: true },
    { href: "/notifications", icon: "bell", label: "Notificaciones", requiresAuth: true },
    { href: "/profile", icon: "user", label: "Perfil", requiresAuth: true },
    { href: "/dashboard", icon: "dashboard", label: "Dashboard", requiresAuth: true }
  ];

  if (hasGovernmentAccess) {
    links.push({
      icon: "shield",
      key: "government",
      label: "Gobierno",
      children: [
        { href: "/government", icon: "shield", label: "Panel gobierno" },
        { href: "/districts", icon: "map", label: "Delegaciones" },
        { href: "/properties", icon: "landmark", label: "Propiedades" },
        { href: "/transparency/government", icon: "clipboard", label: "Transparencia" }
      ]
    });
  }

  if (hasAdminAccess) {
    links.push({
      icon: "shield",
      key: "admin",
      label: "Admin",
      children: [
        { href: "/admin", icon: "shield", label: "Panel admin" },
        { href: "/admin/players", icon: "users", label: "Jugadores" },
        { href: "/admin/properties", icon: "landmark", label: "Propiedades" },
        { href: "/admin/organizations", icon: "money", label: "Organizaciones" },
        { href: "/admin/audit", icon: "archive", label: "Auditoria" }
      ]
    });
  }

  if (!profile) {
    links.push({ href: "/login", icon: "login", label: "Entrar" });
  }

  return (
    <NavigationShell
      isAuthenticated={Boolean(profile)}
      links={links.filter((link) => !link.requiresAuth || profile)}
      profileLabel={profile?.display_name || profile?.gamertag || "Visitante"}
    />
  );
}
