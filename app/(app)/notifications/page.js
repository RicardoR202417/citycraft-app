import { ArrowLeft, Bell, Check, Inbox } from "lucide-react";
import { Badge, Button, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireProfile } from "../../../lib/auth";
import { formatMexicoDateTime } from "../../../lib/datetime";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { markNotificationRead } from "./actions";
import styles from "./page.module.css";

export const metadata = {
  title: "Notificaciones - CityCraft App"
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNotificationType(type) {
  const labels = {
    auction_bid_created: "Nueva puja",
    auction_bid_outbid: "Puja superada",
    auction_closed: "Subasta cerrada",
    auction_closed_lost: "Subasta perdida",
    auction_closed_won: "Subasta ganada",
    auction_settled: "Subasta liquidada",
    auction_settlement_failed: "Liquidacion fallida",
    government_fine: "Multa",
    market_offer_created: "Oferta",
    market_offer_response: "Respuesta",
    market_sale_settled: "Venta cerrada",
    organization_invitation_created: "Invitacion",
    organization_invitation_response: "Respuesta invitacion"
  };

  return labels[type] || type;
}

function getNotificationTone(type, readAt) {
  if (readAt) {
    return "neutral";
  }

  const tones = {
    auction_bid_created: "info",
    auction_bid_outbid: "warning",
    auction_closed: "success",
    auction_closed_lost: "neutral",
    auction_closed_won: "success",
    auction_settled: "success",
    auction_settlement_failed: "danger",
    government_fine: "danger",
    market_offer_created: "info",
    market_offer_response: "warning",
    market_sale_settled: "success",
    organization_invitation_created: "info",
    organization_invitation_response: "success"
  };

  return tones[type] || "info";
}

function formatRecipient(notification, profile) {
  if (notification.recipient_organization_id) {
    return notification.organizations?.name || "Organizacion";
  }

  return profile.display_name || profile.gamertag;
}

function getMetadataHint(notification) {
  const metadata = notification.metadata || {};

  if (metadata.bid_amount || metadata.new_bid_amount) {
    return `Monto relacionado: CC$${Number(metadata.bid_amount || metadata.new_bid_amount).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  if (metadata.offer_amount || metadata.amount) {
    return `Monto relacionado: CC$${Number(metadata.offer_amount || metadata.amount).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  return "Evento del sistema";
}

export default async function NotificationsPage() {
  const profile = await requireProfile("/notifications");
  const supabase = await createSupabaseServerClient();

  const { data: memberships = [] } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name)")
    .eq("profile_id", profile.id)
    .eq("is_active", true);

  const filters = [
    `recipient_profile_id.eq.${profile.id}`,
    ...asArray(memberships).map((membership) => `recipient_organization_id.eq.${membership.organization_id}`)
  ];

  const { data: notifications = [] } = await supabase
    .from("notifications")
    .select("id, recipient_profile_id, recipient_organization_id, type, title, body, metadata, read_at, created_at, organizations(name)")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(80);

  const unreadCount = asArray(notifications).filter((notification) => !notification.read_at).length;
  const auctionCount = asArray(notifications).filter((notification) => notification.type?.startsWith("auction_")).length;
  const organizationCount = asArray(notifications).filter((notification) => notification.recipient_organization_id).length;
  const summaryItems = [
    { label: "No leidas", value: unreadCount.toLocaleString("es-MX") },
    { label: "Total visible", value: notifications.length.toLocaleString("es-MX") },
    { label: "Subastas", value: auctionCount.toLocaleString("es-MX") },
    { label: "Organizaciones", value: organizationCount.toLocaleString("es-MX") }
  ];

  const rows = asArray(notifications).map((notification) => ({
    id: notification.id,
    notification: (
      <div className={styles.notificationCell}>
        <strong>{notification.title}</strong>
        <span>{notification.body}</span>
        <span className={styles.metadata}>{getMetadataHint(notification)}</span>
      </div>
    ),
    type: (
      <Badge tone={getNotificationTone(notification.type, notification.read_at)}>
        {formatNotificationType(notification.type)}
      </Badge>
    ),
    recipient: formatRecipient(notification, profile),
    status: notification.read_at ? <Badge>Leida</Badge> : <Badge tone="info">Nueva</Badge>,
    date: formatMexicoDateTime(notification.created_at),
    action: notification.read_at ? (
      "Sin accion"
    ) : (
      <form action={markNotificationRead} className={styles.readAction}>
        <input name="notification_id" type="hidden" value={notification.id} />
        <Button icon={Check} size="sm" type="submit" variant="secondary">
          Marcar leida
        </Button>
      </form>
    )
  }));

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Bandeja privada para avisos importantes de subastas, mercado, gobierno y movimientos del sistema."
        eyebrow="Centro de avisos"
        title="Notificaciones"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            description="Incluye notificaciones personales y de organizaciones donde participas activamente."
            eyebrow="Resumen"
            title="Estado de bandeja"
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.inboxCard}>
          <Bell size={24} />
          <strong>{unreadCount.toLocaleString("es-MX")}</strong>
          <span>Notificaciones pendientes de lectura</span>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          description="Las pujas nuevas y las pujas superadas ya se registran aqui. Los avisos de cierre se conectaran al proceso automatico de subastas."
          eyebrow="Bandeja"
          title="Avisos recientes"
        />
        {rows.length ? (
          <Table
            columns={[
              { key: "notification", label: "Notificacion" },
              { key: "type", label: "Tipo" },
              { key: "recipient", label: "Para" },
              { key: "status", label: "Estado" },
              { key: "date", label: "Fecha" },
              { key: "action", label: "Accion" }
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : (
          <EmptyState
            description="Cuando tengas nuevas ofertas, pujas, multas o cierres importantes, apareceran aqui."
            icon={Inbox}
            title="Sin notificaciones"
          />
        )}
      </Card>
    </main>
  );
}
