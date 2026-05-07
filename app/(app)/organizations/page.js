import { ArrowLeft, Building2, Filter, LandPlot } from "lucide-react";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { isGlobalAdmin, requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
import { OrganizationForm } from "./OrganizationForm";
import { OrganizationInvitationResponseForm } from "./OrganizationInvitationResponseForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Organizaciones - CityCraft App"
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

function includesSearchValue(entry, query) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  const organization = entry.organization || {};

  return [organization.name, organization.slug, organization.type]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

export default async function OrganizationsPage({ searchParams }) {
  const filters = await searchParams;
  const query = typeof filters?.q === "string" ? filters.q.trim() : "";
  const typeFilter = typeof filters?.type === "string" ? filters.type : "all";
  const visibilityFilter = typeof filters?.visibility === "string" ? filters.visibility : "all";
  const profile = await requireProfile("/organizations");
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();
  const isAdmin = await isGlobalAdmin(supabase, profile.id);

  const { data: memberships = [], error } = await supabase
    .from("organization_members")
    .select("id, role, ownership_percent, joined_at, organizations(id, name, slug, description, type, is_public)")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load organizations: ${error.message}`);
  }

  const { data: pendingInvitations = [], error: invitationsError } = await supabase
    .from("organization_invitations")
    .select("id, role, message, created_at, organizations(id, name, slug, description, type, is_public)")
    .eq("invited_profile_id", profile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (invitationsError) {
    throw new Error(`Could not load organization invitations: ${invitationsError.message}`);
  }

  const { data: adminOrganizations = [], error: adminOrganizationsError } = isAdmin
    ? await serviceSupabase
        .from("organizations")
        .select("id, name, slug, description, type, is_public, created_at")
        .order("type", { ascending: true })
        .order("name", { ascending: true })
    : { data: [] };

  if (adminOrganizationsError) {
    throw new Error(`Could not load admin organizations: ${adminOrganizationsError.message}`);
  }

  const organizationEntries = isAdmin
    ? adminOrganizations.map((organization) => ({
        id: organization.id,
        joinedAt: organization.created_at,
        organization,
        ownershipPercent: null,
        role: "global_admin"
      }))
    : memberships.map((membership) => ({
        id: membership.id,
        joinedAt: membership.joined_at,
        organization: membership.organizations,
        ownershipPercent: membership.ownership_percent,
        role: membership.role
      }));

  const filteredOrganizationEntries = organizationEntries
    .filter((entry) => includesSearchValue(entry, query))
    .filter((entry) => typeFilter === "all" || entry.organization?.type === typeFilter)
    .filter((entry) => {
      if (visibilityFilter === "all") {
        return true;
      }

      return visibilityFilter === "public" ? entry.organization?.is_public : !entry.organization?.is_public;
    });

  const rows = filteredOrganizationEntries.map((entry) => ({
    id: entry.id,
    name: (
      <div className={styles.organizationName}>
        {entry.organization?.slug ? (
          <Link href={`/organizations/${entry.organization.slug}`}>
            {entry.organization.name || "Organizacion no disponible"}
          </Link>
        ) : (
          <strong>Organizacion no disponible</strong>
        )}
        <span>{entry.organization?.slug || "sin-slug"}</span>
      </div>
    ),
    role: (
      <Badge tone={entry.role === "owner" || entry.role === "global_admin" ? "success" : "neutral"}>
        {entry.role === "global_admin" ? "Admin global" : formatRole(entry.role)}
      </Badge>
    ),
    ownership:
      entry.ownershipPercent === null
        ? "Gestion total"
        : `${Number(entry.ownershipPercent || 0).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}%`,
    visibility: (
      <Badge tone={entry.organization?.is_public ? "info" : "neutral"}>
        {entry.organization?.is_public ? "Publica" : "Privada"}
      </Badge>
    ),
    type: entry.organization?.type === "government" ? "Gobierno" : "Privada",
    joinedAt: formatDate(entry.joinedAt),
    detail: entry.organization?.slug ? (
      <Link className={styles.detailLink} href={`/organizations/${entry.organization.slug}`}>
        Ver
      </Link>
    ) : (
      "No disponible"
    )
  }));

  const invitationRows = pendingInvitations.map((invitation) => ({
    id: invitation.id,
    name: (
      <div className={styles.organizationName}>
        <strong>{invitation.organizations?.name || "Organizacion no disponible"}</strong>
        <span>{invitation.organizations?.slug || "sin-slug"}</span>
      </div>
    ),
    role: <Badge tone={invitation.role === "owner" ? "success" : invitation.role === "admin" ? "info" : "neutral"}>{formatRole(invitation.role)}</Badge>,
    type: invitation.organizations?.type === "government" ? "Gobierno" : "Privada",
    visibility: (
      <Badge tone={invitation.organizations?.is_public ? "info" : "neutral"}>
        {invitation.organizations?.is_public ? "Publica" : "Privada"}
      </Badge>
    ),
    message: invitation.message || "Sin mensaje",
    invitedAt: formatDate(invitation.created_at),
    response: <OrganizationInvitationResponseForm invitationId={invitation.id} />
  }));

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Crea empresas privadas, sociedades y proyectos economicos con wallet propia dentro de CityCraft."
        eyebrow="Organizaciones"
        title="Empresas y sociedades"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Nueva organizacion"
            title="Crear organizacion privada"
            description="El creador queda como propietario inicial y la organizacion recibe wallet automaticamente."
          />
          <OrganizationForm />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Estado"
            title="Base organizacional"
            description="Esta primera version habilita creacion; administracion de socios y porcentajes avanza en las siguientes historias."
          />
          <div className={styles.stats}>
            <article>
              <Building2 size={20} />
              <strong>{organizationEntries.length}</strong>
              <span>{isAdmin ? "Organizaciones visibles" : "Organizaciones activas"}</span>
            </article>
            <article>
              <LandPlot size={20} />
              <strong>{memberships.filter((membership) => membership.role === "owner").length}</strong>
              <span>Como propietario</span>
            </article>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Invitaciones"
          title="Invitaciones pendientes"
          description="Solo el jugador invitado puede aceptar o rechazar una invitacion."
        />
        {invitationRows.length ? (
          <Table
            columns={[
              { key: "name", label: "Organizacion" },
              { key: "role", label: "Rol propuesto" },
              { key: "type", label: "Tipo" },
              { key: "visibility", label: "Visibilidad" },
              { key: "message", label: "Mensaje" },
              { key: "invitedAt", label: "Invitada" },
              { key: "response", label: "Responder" }
            ]}
            getRowKey={(row) => row.id}
            rows={invitationRows}
          />
        ) : (
          <EmptyState
            description="Cuando una organizacion te invite, podras responder desde aqui."
            icon={Building2}
            title="Sin invitaciones pendientes"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="CRUD centralizado"
          title="Organizaciones visibles"
          description="Busca y filtra organizaciones segun tus permisos antes de abrir su detalle operativo."
        />
        <form className={styles.filters} action="/organizations">
          <label>
            Buscar
            <input defaultValue={query} name="q" placeholder="Nombre, slug o tipo" />
          </label>
          <label>
            Tipo
            <select defaultValue={typeFilter} name="type">
              <option value="all">Todas</option>
              <option value="private">Privadas</option>
              <option value="government">Gobierno</option>
            </select>
          </label>
          <label>
            Visibilidad
            <select defaultValue={visibilityFilter} name="visibility">
              <option value="all">Todas</option>
              <option value="public">Publicas</option>
              <option value="private">Privadas</option>
            </select>
          </label>
          <button type="submit">
            <Filter size={16} />
            Filtrar
          </button>
          <Link className={styles.detailLink} href="/organizations">
            Limpiar
          </Link>
        </form>
        {rows.length ? (
          <Table
            columns={[
              { key: "name", label: "Organizacion" },
              { key: "role", label: "Rol" },
              { key: "ownership", label: "Participacion" },
              { key: "visibility", label: "Visibilidad" },
              { key: "type", label: "Tipo" },
              { key: "joinedAt", label: "Desde" },
              { key: "detail", label: "Detalle" }
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : (
          <EmptyState
            description="Crea tu primera organizacion para empezar a administrar proyectos y patrimonio compartido."
            icon={Building2}
            title="Sin organizaciones"
          />
        )}
      </Card>
    </main>
  );
}
