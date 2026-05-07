import {
  Bell,
  Building2,
  CircleDollarSign,
  Gavel,
  Home,
  Landmark,
  LayoutDashboard,
  LogIn,
  MapPinned,
  Shield,
  Store,
  UserCircle
} from "lucide-react";
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
    { href: "/", icon: Home, label: "Foro" },
    { href: "/constructions", icon: Building2, label: "Construcciones" },
    { href: "/districts", icon: MapPinned, label: "Delegaciones", requiresAuth: true },
    { href: "/properties", icon: Landmark, label: "Propiedades", requiresAuth: true },
    { href: "/market", icon: Store, label: "Mercado", requiresAuth: true },
    { href: "/auctions", icon: Gavel, label: "Subastas", requiresAuth: true },
    { href: "/organizations", icon: CircleDollarSign, label: "Organizaciones", requiresAuth: true },
    { href: "/notifications", icon: Bell, label: "Notificaciones", requiresAuth: true },
    { href: "/profile", icon: UserCircle, label: "Perfil", requiresAuth: true },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", requiresAuth: true }
  ];

  if (hasGovernmentAccess) {
    links.push({ href: "/government", icon: Shield, label: "Gobierno" });
  }

  if (hasAdminAccess) {
    links.push({ href: "/admin", icon: Shield, label: "Admin" });
  }

  if (!profile) {
    links.push({ href: "/login", icon: LogIn, label: "Entrar" });
  }

  return (
    <NavigationShell
      isAuthenticated={Boolean(profile)}
      links={links.filter((link) => !link.requiresAuth || profile)}
      profileLabel={profile?.display_name || profile?.gamertag || "Visitante"}
    />
  );
}
