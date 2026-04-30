import { ArrowLeft, Building2, LandPlot, WalletCards } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../../components/ui";
import { requireProfile } from "../../../../lib/auth";
import { formatMoney, formatWalletBalance } from "../../../../lib/economy";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
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

function formatRole(role) {
  const labels = {
    admin: "Admin",
    member: "Miembro",
    owner: "Propietario"
  };

  return labels[role] || role;
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

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, currency_symbol, updated_at")
    .eq("owner_organization_id", organization.id)
    .maybeSingle();

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

  const portfolioValue = propertyOwners.reduce((total, owner) => {
    const propertyValue = Number(owner.properties?.current_value || 0);
    const ownership = Number(owner.ownership_percent || 0) / 100;
    return total + propertyValue * ownership;
  }, 0);

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
            title="Wallet y patrimonio"
            description="Lectura rapida del saldo y valor inmobiliario asignado a la organizacion."
          />
          <div className={styles.balance}>
            <WalletCards size={24} />
            <strong>{formatWalletBalance(wallet)}</strong>
            <span>Wallet de organizacion</span>
          </div>
          <div className={styles.stats}>
            <article>
              <LandPlot size={20} />
              <strong>{formatMoney(portfolioValue)}</strong>
              <span>Valor inmobiliario proporcional</span>
            </article>
            <article>
              <Building2 size={20} />
              <strong>{propertyOwners.length}</strong>
              <span>Propiedades asociadas</span>
            </article>
          </div>
        </Card>
      </section>

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
