import { ArrowLeft, Building2, HandCoins, LandPlot, WalletCards } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../../components/ui";
import { requireProfile } from "../../../../lib/auth";
import { formatMoney, formatWalletBalance } from "../../../../lib/economy";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../../lib/supabase/server";
import { MemberShareForm } from "./MemberShareForm";
import { OrganizationInviteForm } from "./OrganizationInviteForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Detalle de organizacion - CityCraft App"
};

function formatDate(value) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatDay(value) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
  }).format(new Date(`${value}T00:00:00`));
}

function formatRole(role) {
  const labels = {
    admin: "Admin",
    member: "Miembro",
    owner: "Propietario"
  };

  return labels[role] || role;
}

function formatPayoutRate(value) {
  return `${(Number(value || 0) * 100).toLocaleString("es-MX", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  })}%`;
}

function formatPropertyType(type) {
  const labels = {
    commercial: "Local",
    corporate: "Corporativo",
    cultural: "Cultural",
    entertainment: "Entretenimiento",
    infrastructure: "Infraestructura",
    land: "Terreno",
    public: "Publica",
    residential: "Habitacional",
    service: "Servicio"
  };

  return labels[type] || type;
}

export default async function OrganizationDetailPage({ params }) {
  const profile = await requireProfile("/organizations");
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, description, type, is_public, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (organizationError) {
    throw new Error(`Could not load organization: ${organizationError.message}`);
  }

  if (!organization) {
    notFound();
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, role, ownership_percent, joined_at")
    .eq("organization_id", organization.id)
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Could not load organization membership: ${membershipError.message}`);
  }

  if (!membership) {
    redirect("/organizations");
  }

  const canManageMembers = ["owner", "admin"].includes(membership.role);

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, currency_symbol, updated_at")
    .eq("owner_organization_id", organization.id)
    .maybeSingle();

  const { data: marketValue = {}, error: marketValueError } = await supabase.rpc("calculate_organization_market_value", {
    p_organization_id: organization.id
  });

  if (marketValueError) {
    throw new Error(`Could not load organization market value: ${marketValueError.message}`);
  }

  const { data: propertyOwners = [], error: propertiesError } = await supabase
    .from("property_owners")
    .select(
      "id, ownership_percent, properties(id, name, address, type, current_value, size_blocks, districts(name))"
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (propertiesError) {
    throw new Error(`Could not load organization properties: ${propertiesError.message}`);
  }

  const { data: memberRows = [], error: membersError } = await serviceSupabase
    .from("organization_members")
    .select("id, profile_id, role, ownership_percent, joined_at, profiles!organization_members_profile_id_fkey(gamertag, display_name)")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("ownership_percent", { ascending: false })
    .order("joined_at", { ascending: true });

  if (membersError) {
    throw new Error(`Could not load organization members: ${membersError.message}`);
  }

  const { data: invitationRows = [], error: invitationsError } = await serviceSupabase
    .from("organization_invitations")
    .select("id, role, status, message, created_at, responded_at, invited_profile_id, invited_by, profiles!organization_invitations_invited_profile_id_fkey(gamertag, display_name)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (invitationsError) {
    throw new Error(`Could not load organization invitations: ${invitationsError.message}`);
  }

  const { data: playerRows = [], error: playersError } = canManageMembers
    ? await serviceSupabase
        .from("profiles")
        .select("id, gamertag, display_name, gamertag_uid")
        .order("gamertag", { ascending: true })
        .limit(100)
    : { data: [] };

  if (playersError) {
    throw new Error(`Could not load players for invitations: ${playersError.message}`);
  }

  const { data: organizationPayouts = [], error: organizationPayoutsError } = await supabase
    .from("organization_daily_payouts")
    .select(
      "id, profile_id, payout_date, gross_property_value, payout_rate, attendance_ownership_percent, payout_amount, ledger_entry_id, profiles!organization_daily_payouts_profile_id_fkey(gamertag, display_name)"
    )
    .eq("organization_id", organization.id)
    .order("payout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);

  if (organizationPayoutsError) {
    throw new Error(`Could not load organization payouts: ${organizationPayoutsError.message}`);
  }

  const portfolioValue = Number(marketValue.property_value || 0);
  const assignedPercent = memberRows.reduce((total, member) => total + Number(member.ownership_percent || 0), 0);
  const walletCurrency = wallet?.currency_symbol;
  const activeMemberProfileIds = new Set(memberRows.map((member) => member.profile_id));
  const pendingInvitationProfileIds = new Set(
    invitationRows
      .filter((invitation) => invitation.status === "pending")
      .map((invitation) => invitation.invited_profile_id)
  );
  const playerOptions = playerRows
    .filter((player) => player.id !== profile.id)
    .filter((player) => !activeMemberProfileIds.has(player.id))
    .filter((player) => !pendingInvitationProfileIds.has(player.id))
    .map((player) => ({
      id: player.id,
      label: `${player.display_name || player.gamertag}${player.gamertag_uid ? ` (${player.gamertag_uid})` : ""}`
    }));

  const participationItems = [
    { label: "Rol", value: formatRole(membership.role) },
    {
      label: "Participacion",
      value: `${Number(membership.ownership_percent || 0).toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}%`
    },
    { label: "Miembro desde", value: formatDate(membership.joined_at) },
    { label: "Visibilidad", value: organization.is_public ? "Publica" : "Privada" },
    { label: "Tipo", value: organization.type === "government" ? "Gobierno" : "Privada" }
  ];

  const propertyRows = propertyOwners.map((owner) => ({
    id: owner.id,
    name: (
      <div className={styles.propertyName}>
        <strong>{owner.properties?.name || "Propiedad no disponible"}</strong>
        <span>{owner.properties?.address || "Sin direccion"}</span>
      </div>
    ),
    district: owner.properties?.districts?.name || "Sin delegacion",
    type: <Badge tone="info">{formatPropertyType(owner.properties?.type)}</Badge>,
    ownership: `${Number(owner.ownership_percent || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`,
    value: formatMoney(owner.properties?.current_value || 0),
    organizationValue: formatMoney(Number(owner.properties?.current_value || 0) * (Number(owner.ownership_percent || 0) / 100))
  }));

  const memberTableRows = memberRows.map((member) => ({
    id: member.id,
    player: (
      <div className={styles.propertyName}>
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
    management: canManageMembers ? (
      <MemberShareForm membership={member} organizationSlug={organization.slug} />
    ) : (
      "Solo lectura"
    )
  }));

  const invitationTableRows = invitationRows.map((invitation) => ({
    id: invitation.id,
    player: (
      <div className={styles.propertyName}>
        <strong>{invitation.profiles?.display_name || invitation.profiles?.gamertag || "Jugador no disponible"}</strong>
        <span>{invitation.profiles?.gamertag || "Sin gamertag"}</span>
      </div>
    ),
    role: <Badge tone={invitation.role === "owner" ? "success" : invitation.role === "admin" ? "info" : "neutral"}>{formatRole(invitation.role)}</Badge>,
    status: (
      <Badge tone={invitation.status === "pending" ? "warning" : invitation.status === "accepted" ? "success" : "neutral"}>
        {invitation.status === "pending" ? "Pendiente" : invitation.status === "accepted" ? "Aceptada" : invitation.status === "rejected" ? "Rechazada" : "Cancelada"}
      </Badge>
    ),
    message: invitation.message || "Sin mensaje",
    createdAt: formatDate(invitation.created_at),
    respondedAt: formatDate(invitation.responded_at)
  }));

  const payoutRows = organizationPayouts.map((payout) => ({
    id: payout.id,
    player: payout.profiles?.display_name || payout.profiles?.gamertag || "Socio no disponible",
    day: formatDay(payout.payout_date),
    grossValue: formatMoney(payout.gross_property_value, walletCurrency),
    rate: formatPayoutRate(payout.payout_rate),
    attendanceShare: `${Number(payout.attendance_ownership_percent || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`,
    amount: <strong>{formatMoney(payout.payout_amount, walletCurrency)}</strong>,
    ledger: (
      <Badge tone={payout.ledger_entry_id ? "success" : "neutral"}>
        {payout.ledger_entry_id ? "Con ledger" : "Pago cero"}
      </Badge>
    )
  }));

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/organizations" icon={ArrowLeft} variant="secondary">
            Organizaciones
          </LinkButton>
        }
        description={organization.description || "Organizacion privada de CityCraft."}
        eyebrow="Detalle de organizacion"
        title={organization.name}
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Mi participacion"
            title="Relacion con la organizacion"
            description="Datos visibles segun tu membresia activa."
          />
          <DataList items={participationItems} />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Economia"
            title="Patrimonio inicial"
            description="Calculo centralizado con wallet, valor inmobiliario proporcional y ajustes futuros."
          />
          <div className={styles.balance}>
            <WalletCards size={24} />
            <strong>{formatMoney(marketValue.market_value || 0, walletCurrency)}</strong>
            <span>Patrimonio estimado de la organizacion</span>
          </div>
          <div className={styles.stats}>
            <article>
              <WalletCards size={20} />
              <strong>{formatWalletBalance(wallet)}</strong>
              <span>Saldo en wallet</span>
            </article>
            <article>
              <LandPlot size={20} />
              <strong>{formatMoney(portfolioValue, walletCurrency)}</strong>
              <span>Valor inmobiliario proporcional</span>
            </article>
            <article>
              <Building2 size={20} />
              <strong>{Number(marketValue.property_count || propertyOwners.length)}</strong>
              <span>Propiedades activas asociadas</span>
            </article>
            <article>
              <Building2 size={20} />
              <strong>{assignedPercent.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}%</strong>
              <span>Participacion asignada</span>
            </article>
            <article>
              <Building2 size={20} />
              <strong>{formatMoney(Number(marketValue.stability_adjustment || 0) + Number(marketValue.activity_adjustment || 0), walletCurrency)}</strong>
              <span>Ajustes por estabilidad y actividad</span>
            </article>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Socios"
          title="Participaciones de la organizacion"
          description="Los porcentajes activos no pueden superar 100%. Estos porcentajes se usaran para pagos proporcionales por asistencia."
        />
        {memberTableRows.length ? (
          <Table
            columns={[
              { key: "player", label: "Jugador" },
              { key: "role", label: "Rol" },
              { key: "ownership", label: "Participacion" },
              { key: "joinedAt", label: "Desde" },
              { key: "management", label: canManageMembers ? "Administrar" : "Estado" }
            ]}
            getRowKey={(row) => row.id}
            rows={memberTableRows}
          />
        ) : (
          <EmptyState
            description="Cuando existan socios activos, apareceran aqui con su rol y participacion."
            icon={Building2}
            title="Sin socios activos"
          />
        )}
      </Card>

      {canManageMembers ? (
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Invitar"
            title="Invitar nuevos socios"
            description="La invitacion queda pendiente hasta que el jugador la acepte desde su panel de organizaciones."
          />
          {playerOptions.length ? (
            <OrganizationInviteForm
              organizationId={organization.id}
              organizationSlug={organization.slug}
              playerOptions={playerOptions}
            />
          ) : (
            <EmptyState
              description="No hay jugadores disponibles para invitar o ya tienen invitacion pendiente."
              icon={Building2}
              title="Sin jugadores disponibles"
            />
          )}
        </Card>
      ) : null}

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Historial"
          title="Invitaciones recientes"
          description="Registro de invitaciones enviadas por administradores de la organizacion."
        />
        {invitationTableRows.length ? (
          <Table
            columns={[
              { key: "player", label: "Jugador" },
              { key: "role", label: "Rol propuesto" },
              { key: "status", label: "Estado" },
              { key: "message", label: "Mensaje" },
              { key: "createdAt", label: "Invitada" },
              { key: "respondedAt", label: "Respondida" }
            ]}
            getRowKey={(row) => row.id}
            rows={invitationTableRows}
          />
        ) : (
          <EmptyState
            description="Cuando invites jugadores, el historial aparecera aqui con estado pendiente, aceptado o rechazado."
            icon={Building2}
            title="Sin invitaciones registradas"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Rendimiento"
          title="Pagos proporcionales recientes"
          description="Pagos recibidos por la organizacion cuando un socio con participacion registra asistencia valida."
        />
        {payoutRows.length ? (
          <Table
            columns={[
              { key: "player", label: "Socio asistente" },
              { key: "day", label: "Fecha" },
              { key: "grossValue", label: "Valor base org." },
              { key: "rate", label: "Tasa" },
              { key: "attendanceShare", label: "% socio" },
              { key: "amount", label: "Pago" },
              { key: "ledger", label: "Ledger" }
            ]}
            getRowKey={(row) => row.id}
            rows={payoutRows}
          />
        ) : (
          <EmptyState
            description="Cuando el gobierno registre asistencia de un socio, los pagos proporcionales apareceran aqui."
            icon={HandCoins}
            title="Sin pagos proporcionales"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Propiedades"
          title="Portafolio visible"
          description="Propiedades donde la organizacion aparece como propietaria directa."
        />
        {propertyRows.length ? (
          <Table
            columns={[
              { key: "name", label: "Propiedad" },
              { key: "district", label: "Delegacion" },
              { key: "type", label: "Tipo" },
              { key: "ownership", label: "Participacion" },
              { key: "value", label: "Valor total" },
              { key: "organizationValue", label: "Valor org." }
            ]}
            getRowKey={(row) => row.id}
            rows={propertyRows}
          />
        ) : (
          <EmptyState
            description="Cuando la organizacion sea propietaria de terrenos, locales o edificios, apareceran aqui."
            icon={LandPlot}
            title="Sin propiedades asociadas"
          />
        )}
      </Card>
    </main>
  );
}
