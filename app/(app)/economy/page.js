import { ArrowDownLeft, ArrowUpRight, LayoutDashboard, ReceiptText, WalletCards } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireProfile } from "../../../lib/auth";
import { formatMoney, formatWalletBalance, getWalletCurrency } from "../../../lib/economy";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Economia - CityCraft App"
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

function getMovementDirection(entry, walletId) {
  if (entry.to_wallet_id === walletId) {
    return {
      icon: ArrowDownLeft,
      label: "Entrada",
      tone: "success",
      sign: "+"
    };
  }

  return {
    icon: ArrowUpRight,
    label: "Salida",
    tone: "warning",
    sign: "-"
  };
}

function formatEntryType(type) {
  const labels = {
    daily_player_payout: "Pago diario jugador",
    daily_org_payout: "Pago diario organizacion",
    manual_adjustment: "Ajuste manual",
    tax: "Impuesto",
    fee: "Comision",
    property_sale: "Venta de propiedad",
    property_transfer: "Transferencia de propiedad",
    auction_settlement: "Cierre de subasta",
    system_adjustment: "Ajuste del sistema"
  };

  return labels[type] || type;
}

export default async function EconomyPage() {
  const profile = await requireProfile("/economy");
  const supabase = await createSupabaseServerClient();

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("id, balance, currency_symbol, created_at, updated_at")
    .eq("owner_profile_id", profile.id)
    .maybeSingle();

  if (walletError) {
    throw new Error(`Could not load wallet: ${walletError.message}`);
  }

  const { data: entries = [], error: ledgerError } = wallet
    ? await supabase
        .from("ledger_entries")
        .select(
          "id, entry_type, amount, currency_symbol, from_wallet_id, to_wallet_id, reference_type, description, created_at"
        )
        .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [], error: null };

  if (ledgerError) {
    throw new Error(`Could not load ledger entries: ${ledgerError.message}`);
  }

  const currencySymbol = getWalletCurrency(wallet);
  const incomingTotal = entries
    .filter((entry) => entry.to_wallet_id === wallet?.id)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const outgoingTotal = entries
    .filter((entry) => entry.from_wallet_id === wallet?.id)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);

  const rows = entries.map((entry) => {
    const direction = getMovementDirection(entry, wallet.id);
    const DirectionIcon = direction.icon;

    return {
      id: entry.id,
      movement: (
        <span className={styles.movement}>
          <DirectionIcon size={16} />
          <Badge tone={direction.tone}>{direction.label}</Badge>
        </span>
      ),
      type: formatEntryType(entry.entry_type),
      amount: (
        <strong className={direction.sign === "+" ? styles.income : styles.outcome}>
          {direction.sign}
          {formatMoney(entry.amount, entry.currency_symbol || currencySymbol)}
        </strong>
      ),
      reference: entry.reference_type || "General",
      description: entry.description || "Sin descripcion",
      createdAt: formatDate(entry.created_at)
    };
  });

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={LayoutDashboard} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Historial de saldo y movimientos relacionados con tu jugador. Este libro sera la fuente auditable de la economia."
        eyebrow="Economia"
        title="Billetera y ledger"
      />

      <section className={styles.summaryGrid}>
        <Card className={styles.balanceCard}>
          <SectionHeader
            eyebrow="Saldo actual"
            title="Billetera de jugador"
            description="El saldo solo debe cambiar mediante movimientos registrados en ledger."
          />
          <div className={styles.balance}>
            <WalletCards size={26} />
            <strong>{formatWalletBalance(wallet)}</strong>
            <span>Ultima actualizacion: {formatDate(wallet?.updated_at)}</span>
          </div>
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Resumen"
            title="Ultimos movimientos"
            description="Totales calculados sobre los movimientos visibles recientes."
          />
          <DataList
            items={[
              { label: "Entradas recientes", value: formatMoney(incomingTotal, currencySymbol) },
              { label: "Salidas recientes", value: formatMoney(outgoingTotal, currencySymbol) },
              { label: "Movimientos visibles", value: entries.length }
            ]}
          />
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Ledger"
          title="Historial economico"
          description="Cada pago, venta, impuesto, comision o ajuste quedara registrado con fecha y referencia."
        />
        {rows.length ? (
          <Table
            columns={[
              { key: "movement", label: "Movimiento" },
              { key: "type", label: "Tipo" },
              { key: "amount", label: "Monto" },
              { key: "reference", label: "Referencia" },
              { key: "description", label: "Descripcion" },
              { key: "createdAt", label: "Fecha" }
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : (
          <EmptyState
            description="Cuando el gobierno registre pagos o existan transferencias, los movimientos apareceran aqui."
            icon={ReceiptText}
            title="Aun no hay movimientos"
          />
        )}
      </Card>
    </main>
  );
}
