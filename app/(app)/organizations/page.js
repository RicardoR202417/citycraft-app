import { ArrowLeft, Building2, LandPlot } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { OrganizationForm } from "./OrganizationForm";
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

export default async function OrganizationsPage() {
  const profile = await requireProfile("/organizations");
  const supabase = await createSupabaseServerClient();

  const { data: memberships = [], error } = await supabase
    .from("organization_members")
    .select("id, role, ownership_percent, joined_at, organizations(id, name, slug, description, type, is_public)")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load organizations: ${error.message}`);
  }

  const rows = memberships.map((membership) => ({
    id: membership.id,
    name: (
      <div className={styles.organizationName}>
        <strong>{membership.organizations?.name || "Organizacion no disponible"}</strong>
        <span>{membership.organizations?.slug || "sin-slug"}</span>
      </div>
    ),
    role: <Badge tone={membership.role === "owner" ? "success" : "neutral"}>{formatRole(membership.role)}</Badge>,
    ownership: `${Number(membership.ownership_percent || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`,
    visibility: (
      <Badge tone={membership.organizations?.is_public ? "info" : "neutral"}>
        {membership.organizations?.is_public ? "Publica" : "Privada"}
      </Badge>
    ),
    type: membership.organizations?.type === "government" ? "Gobierno" : "Privada",
    joinedAt: formatDate(membership.joined_at)
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
              <strong>{memberships.length}</strong>
              <span>Organizaciones activas</span>
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
          eyebrow="Mis organizaciones"
          title="Participaciones actuales"
          description="Listado inicial de organizaciones donde formas parte activa."
        />
        {rows.length ? (
          <Table
            columns={[
              { key: "name", label: "Organizacion" },
              { key: "role", label: "Rol" },
              { key: "ownership", label: "Participacion" },
              { key: "visibility", label: "Visibilidad" },
              { key: "type", label: "Tipo" },
              { key: "joinedAt", label: "Desde" }
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
