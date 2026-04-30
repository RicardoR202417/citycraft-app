import { Building2, LandPlot, Landmark, LogOut, MapPinned, ShieldCheck, UserRoundPen, WalletCards } from "lucide-react";
import { Badge, Button, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader } from "../../../components/ui";
import { getProfileVisibility, isGlobalAdmin, isGovernmentMember, requireProfile } from "../../../lib/auth";
import { formatWalletBalance } from "../../../lib/economy";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { signOut } from "./actions";
import styles from "./page.module.css";

export const metadata = {
  title: "Dashboard - CityCraft App"
};

export default async function DashboardPage() {
  const profile = await requireProfile("/dashboard");
  const visibility = getProfileVisibility(profile);
  const supabase = await createSupabaseServerClient();

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance, currency_symbol")
    .eq("owner_profile_id", profile.id)
    .maybeSingle();

  const { data: memberships = [] } = await supabase
    .from("organization_members")
    .select("role, ownership_percent, organizations(name, type)")
    .eq("profile_id", profile.id)
    .eq("is_active", true);

  const hasGovernmentAccess = await isGovernmentMember(supabase, profile.id);
  const hasAdminAccess = await isGlobalAdmin(supabase, profile.id);

  const profileItems = [
    { label: "Gamertag", value: profile.gamertag },
    { label: "Gamertag UID", value: profile.gamertag_uid || "Pendiente" },
    { label: "Perfil publico", value: visibility.profile ? "Visible" : "Privado" },
    { label: "Billetera publica", value: visibility.wallet ? "Visible" : "Privada" }
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <>
            {hasAdminAccess ? (
              <LinkButton href="/admin" icon={ShieldCheck} variant="secondary">
                Admin
              </LinkButton>
            ) : null}
            {hasGovernmentAccess ? (
              <LinkButton href="/government" icon={Landmark} variant="secondary">
                Gobierno
              </LinkButton>
            ) : null}
            <LinkButton href="/properties" icon={MapPinned} variant="secondary">
              Propiedades
            </LinkButton>
            <LinkButton href="/organizations" icon={Building2} variant="secondary">
              Organizaciones
            </LinkButton>
            <LinkButton href="/economy" icon={WalletCards} variant="secondary">
              Economia
            </LinkButton>
            <LinkButton href="/profile" icon={UserRoundPen} variant="secondary">
              Perfil
            </LinkButton>
            <form action={signOut}>
              <Button icon={LogOut} type="submit" variant="secondary">
                Salir
              </Button>
            </form>
          </>
        }
        description="Base privada para revisar identidad, billetera y organizaciones antes de construir los modulos reales."
        eyebrow="Panel privado"
        title={`Hola, ${profile.display_name || profile.gamertag}`}
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Identidad"
            title="Perfil de jugador"
            description="Estos datos salen de Supabase y respetan las politicas RLS."
          />
          <DataList items={profileItems} />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Economia"
            title="Billetera"
            description="La wallet se crea automaticamente cuando existe el perfil."
          />
          <div className={styles.balance}>
            <WalletCards size={24} />
            <strong>{formatWalletBalance(wallet)}</strong>
            <span>Saldo inicial</span>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Organizaciones"
          title="Participaciones"
          description="Aqui apareceran empresas, gobierno y porcentajes del jugador."
        />
        {memberships.length ? (
          <div className={styles.memberships}>
            {memberships.map((membership) => (
              <article key={`${membership.organizations.name}-${membership.role}`}>
                <Building2 size={18} />
                <div>
                  <strong>{membership.organizations.name}</strong>
                  <span>{membership.role}</span>
                </div>
                <Badge tone={membership.organizations.type === "government" ? "info" : "neutral"}>
                  {membership.ownership_percent}%
                </Badge>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Cuando formes parte de una empresa o del gobierno, la relacion aparecera en este espacio."
            icon={LandPlot}
            title="Sin organizaciones activas"
          />
        )}
      </Card>
    </main>
  );
}
