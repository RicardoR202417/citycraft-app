import { ArrowLeft, ClipboardList, ReceiptText, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../../components/ui";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { formatMoney } from "../../../../lib/economy";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";
import { ReverseLedgerEntryForm } from "./AuditForms";
import styles from "./page.module.css";

export const metadata = {
  title: "Auditoria - Admin - CityCraft App"
};

function formatDate(value) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatEntryType(type) {
  const labels = {
    auction_settlement: "Cierre de subasta",
    daily_org_payout: "Pago diario organizacion",
    daily_player_payout: "Pago diario jugador",
    fee: "Comision",
    manual_adjustment: "Ajuste manual",
    property_sale: "Venta de propiedad",
    property_transfer: "Transferencia de propiedad",
    system_adjustment: "Ajuste del sistema",
    tax: "Impuesto"
  };

  return labels[type] || type;
}

function getWalletLabel(wallet) {
  if (!wallet) {
    return "Wallet no disponible";
  }

  if (wallet.profiles) {
    return wallet.profiles.display_name || wallet.profiles.gamertag || "Jugador";
  }

  if (wallet.organizations) {
    return wallet.organizations.name || "Organizacion";
  }

  return wallet.id;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function AdminAuditPage() {
  await requireGlobalAdminProfile("/admin/audit");
  const serviceSupabase = getSupabaseServiceClient();

  const [{ data: auditEventsData = [] }, { data: ledgerEntriesData = [] }] = await Promise.all([
    serviceSupabase
      .from("audit_logs")
      .select("id, actor_profile_id, action, entity_type, entity_id, metadata, created_at, profiles!audit_logs_actor_profile_id_fkey(gamertag, display_name)")
      .order("created_at", { ascending: false })
      .limit(60),
    serviceSupabase
      .from("ledger_entries")
      .select("id, entry_type, amount, currency_symbol, from_wallet_id, to_wallet_id, reference_type, reference_id, description, metadata, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(60)
  ]);

  const auditEvents = asArray(auditEventsData);
  const ledgerEntries = asArray(ledgerEntriesData);
  const walletIds = [
    ...new Set(
      ledgerEntries
        .flatMap((entry) => [entry.from_wallet_id, entry.to_wallet_id])
        .filter(Boolean)
    )
  ];
  const ledgerIds = ledgerEntries.map((entry) => entry.id);

  const [{ data: walletsData = [] }, { data: reversalEntriesData = [] }] = await Promise.all([
    walletIds.length
      ? serviceSupabase
          .from("wallets")
          .select("id, balance, currency_symbol, owner_profile_id, owner_organization_id, profiles!wallets_owner_profile_id_fkey(gamertag, display_name), organizations!wallets_owner_organization_id_fkey(name, type)")
          .in("id", walletIds)
      : { data: [] },
    ledgerIds.length
      ? serviceSupabase
          .from("ledger_entries")
          .select("id, reference_id")
          .eq("reference_type", "ledger_reversal")
          .in("reference_id", ledgerIds)
      : { data: [] }
  ]);

  const wallets = asArray(walletsData);
  const reversalEntries = asArray(reversalEntriesData);
  const walletsById = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  const reversedLedgerIds = new Set(reversalEntries.map((entry) => entry.reference_id));

  const auditRows = auditEvents.map((event) => ({
    id: event.id,
    action: <code>{event.action}</code>,
    entity: event.entity_type,
    actor: event.profiles?.display_name || event.profiles?.gamertag || "Sistema",
    entityId: event.entity_id || "No aplica",
    createdAt: formatDate(event.created_at)
  }));

  const ledgerRows = ledgerEntries.map((entry) => {
    const toWallet = walletsById.get(entry.to_wallet_id);
    const fromWallet = walletsById.get(entry.from_wallet_id);
    const canReverse = Boolean(entry.to_wallet_id) && entry.reference_type !== "ledger_reversal" && !reversedLedgerIds.has(entry.id);
    const isReversal = entry.reference_type === "ledger_reversal";

    return {
      id: entry.id,
      type: <Badge tone={isReversal ? "warning" : "info"}>{formatEntryType(entry.entry_type)}</Badge>,
      amount: <strong>{formatMoney(entry.amount, entry.currency_symbol)}</strong>,
      wallet: (
        <div className={styles.walletCell}>
          <strong>{entry.to_wallet_id ? getWalletLabel(toWallet) : getWalletLabel(fromWallet)}</strong>
          <span>{entry.to_wallet_id ? "Entrada" : "Salida"}</span>
        </div>
      ),
      reference: entry.reference_type || "General",
      description: entry.description || "Sin descripcion",
      createdAt: formatDate(entry.created_at),
      status: reversedLedgerIds.has(entry.id) ? (
        <Badge tone="warning">Revertido</Badge>
      ) : isReversal ? (
        <Badge tone="neutral">Compensacion</Badge>
      ) : (
        <Badge tone="success">Vigente</Badge>
      ),
      reversal: canReverse ? (
        <ReverseLedgerEntryForm entry={entry} />
      ) : (
        <span className={styles.readOnly}>No disponible</span>
      )
    };
  });

  const summaryItems = [
    { label: "Eventos visibles", value: auditEvents.length.toLocaleString("es-MX") },
    { label: "Movimientos visibles", value: ledgerEntries.length.toLocaleString("es-MX") },
    { label: "Reversiones detectadas", value: reversalEntries.length.toLocaleString("es-MX") },
    { label: "Regla", value: "Compensar, no borrar" }
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/admin" icon={ArrowLeft} variant="secondary">
            Admin
          </LinkButton>
        }
        description="Consulta eventos sensibles y revierte acreditaciones mediante movimientos compensatorios auditados."
        eyebrow="Administracion global"
        title="Auditoria y reversiones"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Resumen"
            title="Control operativo"
            description="La reversion no elimina historial; crea un movimiento correctivo."
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Reglas"
            title="Reversion segura"
            description="Por ahora solo se revierten acreditaciones con saldo suficiente y sin reversion previa."
          />
          <div className={styles.rule}>
            <ShieldCheck size={18} />
            <span>La accion queda registrada como `admin.ledger_entry_reversed`.</span>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Ledger"
          title="Movimientos economicos"
          description="Las acciones disponibles dependen del tipo de movimiento y su estado de reversion."
        />
        {ledgerRows.length ? (
          <Table
            columns={[
              { key: "type", label: "Tipo" },
              { key: "amount", label: "Monto" },
              { key: "wallet", label: "Wallet" },
              { key: "reference", label: "Referencia" },
              { key: "description", label: "Descripcion" },
              { key: "createdAt", label: "Fecha" },
              { key: "status", label: "Estado" },
              { key: "reversal", label: "Reversion" }
            ]}
            getRowKey={(row) => row.id}
            rows={ledgerRows}
          />
        ) : (
          <EmptyState
            description="Cuando existan pagos, ventas, impuestos o ajustes, apareceran aqui para consulta."
            icon={ReceiptText}
            title="Sin movimientos"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Audit log"
          title="Eventos recientes"
          description="Historial de acciones sensibles ejecutadas por jugadores, gobierno y administracion."
        />
        {auditRows.length ? (
          <Table
            columns={[
              { key: "action", label: "Accion" },
              { key: "entity", label: "Entidad" },
              { key: "entityId", label: "ID" },
              { key: "actor", label: "Actor" },
              { key: "createdAt", label: "Fecha" }
            ]}
            getRowKey={(row) => row.id}
            rows={auditRows}
          />
        ) : (
          <EmptyState
            description="Las acciones sensibles quedaran registradas aqui conforme avance el uso de la plataforma."
            icon={ClipboardList}
            title="Sin eventos auditados"
          />
        )}
      </Card>

      <Card className={styles.noteCard}>
        <SectionHeader
          eyebrow="Politica"
          title="No se borra historial"
          description="Una correccion autorizada conserva el movimiento original, crea una compensacion y deja evidencia en auditoria."
        />
        <div className={styles.rule}>
          <RotateCcw size={18} />
          <span>Las reversiones de ventas, subastas y transferencias complejas tendran reglas propias cuando esos modulos existan.</span>
        </div>
      </Card>
    </main>
  );
}
