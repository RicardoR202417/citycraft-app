import { ArrowLeft, Building2, UsersRound, WalletCards } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../../components/ui";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { formatMoney, formatWalletBalance } from "../../../../lib/economy";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";
import {
  AddOrganizationMemberForm,
  DeactivateOrganizationMemberForm,
  UpdateOrganizationMemberForm
} from "./AdminOrganizationForms";
import styles from "./page.module.css";

export const metadata = {
  title: "Organizaciones - Admin - CityCraft App"
};

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatRole(role) {
  const labels = {
    admin: "Admin",
    member: "Miembro",
    owner: "Propietario"
  };

  return labels[role] || role;
}

export default async function AdminOrganizationsPage() {
  await requireGlobalAdminProfile("/admin/organizations");
  const serviceSupabase = getSupabaseServiceClient();

  const [{ data: organizations = [] }, { data: players = [] }] = await Promise.all([
    serviceSupabase
      .from("organizations")
      .select(
        "id, type, name, slug, description, is_public, created_at, wallets(balance, currency_symbol), organization_members(id, organization_id, profile_id, role, ownership_percent, is_active, joined_at, profiles!organization_members_profile_id_fkey(gamertag, display_name))"
      )
      .order("type", { ascending: true })
      .order("created_at", { ascending: false }),
    serviceSupabase
      .from("profiles")
      .select("id, gamertag, display_name")
      .order("gamertag", { ascending: true })
  ]);

  const marketValueResults = await Promise.all(
    organizations.map((organization) =>
      serviceSupabase.rpc("calculate_organization_market_value", {
        p_organization_id: organization.id
      })
    )
  );
  const marketValueError = marketValueResults.find((result) => result.error)?.error;

  if (marketValueError) {
    throw new Error(`Could not load organization market values: ${marketValueError.message}`);
  }

  const marketValuesByOrganization = new Map(
    organizations.map((organization, index) => [organization.id, marketValueResults[index].data || {}])
  );

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/admin" icon={ArrowLeft} variant="secondary">
            Admin
          </LinkButton>
        }
        description="Gestion global de organizaciones, socios, roles y porcentajes. Esta capacidad no depende del rol gobierno."
        eyebrow="Administracion global"
        title="Organizaciones y miembros"
      />

      {organizations.length ? (
        <section className={styles.organizations}>
          {organizations.map((organization) => {
            const wallet = Array.isArray(organization.wallets) ? organization.wallets[0] : organization.wallets;
            const marketValue = marketValuesByOrganization.get(organization.id) || {};
            const members = (organization.organization_members || []).filter((member) => member.is_active);
            const assignedPercent = members.reduce((total, member) => total + Number(member.ownership_percent || 0), 0);
            const summaryItems = [
              { label: "Slug", value: organization.slug },
              { label: "Alta", value: formatDate(organization.created_at) },
              { label: "Patrimonio", value: formatMoney(marketValue.market_value || 0, wallet?.currency_symbol) },
              { label: "Wallet", value: formatWalletBalance(wallet) },
              { label: "Valor propiedades", value: formatMoney(marketValue.property_value || 0, wallet?.currency_symbol) },
              { label: "Propiedades activas", value: Number(marketValue.property_count || 0).toLocaleString("es-MX") },
              {
                label: "Participacion asignada",
                value: `${assignedPercent.toLocaleString("es-MX", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}%`
              }
            ];
            const memberRows = members.map((member) => ({
              id: member.id,
              player: (
                <div className={styles.memberName}>
                  <strong>{member.profiles?.display_name || member.profiles?.gamertag || "Jugador no disponible"}</strong>
                  <span>{member.profiles?.gamertag || "Sin gamertag"}</span>
                </div>
              ),
              role: <Badge tone={member.role === "owner" ? "success" : member.role === "admin" ? "info" : "neutral"}>{formatRole(member.role)}</Badge>,
              ownership: `${Number(member.ownership_percent || 0).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}%`,
              joinedAt: formatDate(member.joined_at),
              edit: <UpdateOrganizationMemberForm member={member} />,
              deactivate: <DeactivateOrganizationMemberForm member={member} />
            }));

            return (
              <Card className={styles.organizationCard} key={organization.id}>
                <div className={styles.organizationHeader}>
                  <div>
                    <span>
                      <Building2 size={18} />
                      Organizacion
                    </span>
                    <h2>{organization.name}</h2>
                  </div>
                  <div className={styles.badges}>
                    <Badge tone={organization.type === "government" ? "info" : "neutral"}>
                      {organization.type === "government" ? "Gobierno" : "Privada"}
                    </Badge>
                    <Badge tone={organization.is_public ? "success" : "neutral"}>
                      {organization.is_public ? "Publica" : "Privada"}
                    </Badge>
                  </div>
                </div>

                <div className={styles.organizationGrid}>
                  <div>
                    <SectionHeader
                      eyebrow="Resumen"
                      title="Datos operativos"
                      description={organization.description || "Sin descripcion registrada."}
                    />
                    <DataList items={summaryItems} />
                  </div>

                  <div>
                    <SectionHeader
                      eyebrow="Alta"
                      title="Agregar socio"
                      description="Puede agregar socios activos o reactivar membresias existentes."
                    />
                    <AddOrganizationMemberForm organization={organization} players={players} />
                  </div>
                </div>

                <div className={styles.membersBlock}>
                  <SectionHeader
                    eyebrow="Socios"
                    title="Miembros activos"
                    description="Los cambios quedan auditados y la base valida que los porcentajes no superen 100%."
                  />
                  {memberRows.length ? (
                    <Table
                      columns={[
                        { key: "player", label: "Jugador" },
                        { key: "role", label: "Rol" },
                        { key: "ownership", label: "%" },
                        { key: "joinedAt", label: "Desde" },
                        { key: "edit", label: "Editar" },
                        { key: "deactivate", label: "Baja" }
                      ]}
                      getRowKey={(row) => row.id}
                      rows={memberRows}
                    />
                  ) : (
                    <EmptyState
                      description="Esta organizacion no tiene miembros activos."
                      icon={UsersRound}
                      title="Sin miembros activos"
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className={styles.emptyCard}>
          <EmptyState
            description="Cuando existan organizaciones privadas o gobierno, apareceran aqui para administracion global."
            icon={Building2}
            title="No hay organizaciones"
          />
        </Card>
      )}

      <Card className={styles.noteCard}>
        <SectionHeader
          eyebrow="Reglas"
          title="Porcentajes y auditoria"
          description="La suma de socios activos no puede superar 100%; las acciones administrativas se registran en audit log."
        />
        <div className={styles.note}>
          <WalletCards size={18} />
          <span>Las wallets de organizacion se crean automaticamente al crear la organizacion.</span>
        </div>
      </Card>
    </main>
  );
}
