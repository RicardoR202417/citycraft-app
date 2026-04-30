import { ArrowLeft, UserRoundCog, UsersRound, WalletCards } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader } from "../../../../components/ui";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";
import { AdminPlayerForm } from "./AdminPlayerForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Jugadores - Admin - CityCraft App"
};

function formatMoney(wallet) {
  const symbol = wallet?.currency_symbol || "CC$";
  const balance = Number(wallet?.balance || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${symbol}${balance}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export default async function AdminPlayersPage() {
  await requireGlobalAdminProfile("/admin/players");

  const serviceSupabase = getSupabaseServiceClient();
  const { data: players = [] } = await serviceSupabase
    .from("profiles")
    .select(
      "id, gamertag, gamertag_uid, display_name, bio, public_profile, public_wallet, created_at, wallets(balance, currency_symbol)"
    )
    .order("created_at", { ascending: false });

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/admin" icon={ArrowLeft} variant="secondary">
            Admin
          </LinkButton>
        }
        description="Consulta y corrige datos basicos de jugadores sin exponer credenciales ni secretos."
        eyebrow="Administracion global"
        title="Jugadores"
      />

      {players.length ? (
        <section className={styles.players}>
          {players.map((player) => {
            const wallet = Array.isArray(player.wallets) ? player.wallets[0] : player.wallets;
            const summaryItems = [
              { label: "ID de perfil", value: player.id },
              { label: "Alta", value: formatDate(player.created_at) },
              { label: "Wallet", value: formatMoney(wallet) },
              { label: "UID", value: player.gamertag_uid || "Pendiente" }
            ];

            return (
              <Card className={styles.playerCard} key={player.id}>
                <div className={styles.playerHeader}>
                  <div>
                    <span>
                      <UserRoundCog size={18} />
                      Jugador
                    </span>
                    <h2>{player.display_name || player.gamertag}</h2>
                  </div>
                  <div className={styles.badges}>
                    <Badge tone={player.public_profile ? "success" : "neutral"}>
                      {player.public_profile ? "Perfil publico" : "Perfil privado"}
                    </Badge>
                    <Badge tone={player.public_wallet ? "info" : "neutral"}>
                      {player.public_wallet ? "Wallet publica" : "Wallet privada"}
                    </Badge>
                  </div>
                </div>

                <div className={styles.playerGrid}>
                  <div>
                    <SectionHeader
                      eyebrow="Resumen"
                      title={player.gamertag}
                      description="Datos operativos del perfil y su wallet."
                    />
                    <DataList items={summaryItems} />
                  </div>

                  <div>
                    <SectionHeader
                      eyebrow="Edicion"
                      title="Identidad"
                      description="Cada cambio queda registrado en auditoria."
                    />
                    <AdminPlayerForm player={player} />
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className={styles.emptyCard}>
          <EmptyState
            description="Cuando existan usuarios autenticados, sus perfiles apareceran aqui para gestion administrativa."
            icon={UsersRound}
            title="No hay jugadores registrados"
          />
        </Card>
      )}

      <Card className={styles.noteCard}>
        <SectionHeader
          eyebrow="Alcance inicial"
          title="Alta de cuentas"
          description="La creacion de usuarios Auth desde admin queda fuera de este sprint. Esta pantalla gestiona perfiles ya existentes."
        />
        <div className={styles.note}>
          <WalletCards size={18} />
          <span>Las wallets se crean automaticamente cuando existe un perfil.</span>
        </div>
      </Card>
    </main>
  );
}
