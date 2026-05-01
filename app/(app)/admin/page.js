import {
  Activity,
  Building2,
  ClipboardList,
  DatabaseZap,
  Landmark,
  ShieldCheck,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireGlobalAdminProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Admin - CityCraft App"
};

async function getTableCount(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    return 0;
  }

  return count || 0;
}

function formatDate(value) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function AdminPage() {
  const profile = await requireGlobalAdminProfile("/admin");
  const supabase = await createSupabaseServerClient();

  const [
    playersCount,
    organizationsCount,
    propertiesCount,
    walletsCount,
    ledgerCount,
    auditCount,
    { data: adminRegistry },
    { data: auditEvents = [] }
  ] = await Promise.all([
    getTableCount(supabase, "profiles"),
    getTableCount(supabase, "organizations"),
    getTableCount(supabase, "properties"),
    getTableCount(supabase, "wallets"),
    getTableCount(supabase, "ledger_entries"),
    getTableCount(supabase, "audit_logs"),
    supabase
      .from("global_admins")
      .select("profile_id, is_active, created_at")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, actor:profiles(gamertag)")
      .order("created_at", { ascending: false })
      .limit(6)
  ]);

  const summaryCards = [
    { label: "Jugadores", value: playersCount, icon: UsersRound },
    { label: "Organizaciones", value: organizationsCount, icon: Building2 },
    { label: "Propiedades", value: propertiesCount, icon: Landmark },
    { label: "Wallets", value: walletsCount, icon: WalletCards },
    { label: "Movimientos", value: ledgerCount, icon: Activity },
    { label: "Auditoria", value: auditCount, icon: ClipboardList }
  ];

  const adminItems = [
    { label: "Admin activo", value: adminRegistry?.profile_id === profile.id ? "Tu usuario" : "Asignado" },
    { label: "Estado", value: adminRegistry?.is_active ? "Activo" : "Pendiente" },
    { label: "Alta", value: formatDate(adminRegistry?.created_at) }
  ];

  const auditRows = auditEvents.map((event) => ({
    action: event.action,
    entity: event.entity_type,
    actor: event.actor?.gamertag || "Sistema",
    createdAt: formatDate(event.created_at)
  }));

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <>
            <LinkButton href="/dashboard" icon={DatabaseZap} variant="secondary">
              Dashboard
            </LinkButton>
            <LinkButton href="/government" icon={Landmark} variant="secondary">
              Gobierno
            </LinkButton>
          </>
        }
        description="Centro operativo para revisar el estado general de la plataforma y administrar datos sensibles con permisos controlados."
        eyebrow="Administracion global"
        title="Panel administrativo"
      />

      <section className={styles.summaryGrid} aria-label="Resumen de plataforma">
        {summaryCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card className={styles.summaryCard} key={item.label}>
              <Icon size={20} />
              <span>{item.label}</span>
              <strong>{item.value.toLocaleString("es-MX")}</strong>
            </Card>
          );
        })}
      </section>

      <section className={styles.contentGrid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Seguridad"
            title="Administrador unico"
            description="La autorizacion se resuelve con RLS y una funcion SQL segura."
          />
          <div className={styles.statusLine}>
            <ShieldCheck size={20} />
            <strong>{profile.gamertag}</strong>
            <Badge tone="success">Acceso verificado</Badge>
          </div>
          <DataList items={adminItems} />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Accesos"
            title="Herramientas iniciales"
            description="Estas secciones creceran junto con los modulos del sistema."
          />
          <div className={styles.links}>
            <LinkButton href="/admin/players" icon={UsersRound} variant="secondary">
              Jugadores
            </LinkButton>
            <LinkButton href="/admin/organizations" icon={Building2} variant="secondary">
              Organizaciones
            </LinkButton>
            <LinkButton href="/properties" icon={Landmark} variant="secondary">
              Propiedades
            </LinkButton>
            <LinkButton href="/government" icon={Building2} variant="secondary">
              Gobierno
            </LinkButton>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Auditoria"
          title="Eventos recientes"
          description="Las acciones sensibles deben dejar trazabilidad conforme avance la economia."
        />
        {auditRows.length ? (
          <Table
            columns={[
              { key: "action", label: "Accion" },
              { key: "entity", label: "Entidad" },
              { key: "actor", label: "Actor" },
              { key: "createdAt", label: "Fecha" }
            ]}
            rows={auditRows}
          />
        ) : (
          <EmptyState
            description="Cuando se creen propiedades, valoraciones o movimientos criticos, apareceran en este historial."
            icon={ClipboardList}
            title="Sin eventos recientes"
          />
        )}
      </Card>
    </main>
  );
}
