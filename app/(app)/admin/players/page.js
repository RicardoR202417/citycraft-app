import { ArrowLeft, Eye, ShieldCheck, UserRoundCog, UsersRound, WalletCards, Wrench } from "lucide-react";
import {
  Badge,
  Card,
  CrudActionList,
  CrudLayout,
  CrudPanel,
  CrudToolbar,
  CrudWorkspace,
  DataList,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionHeader,
  Table
} from "../../../../components/ui";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { formatWalletBalance } from "../../../../lib/economy";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";
import { AdminPlayerForm } from "./AdminPlayerForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Jugadores - Admin - CityCraft App"
};

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getWallet(player) {
  return Array.isArray(player.wallets) ? player.wallets[0] : player.wallets;
}

function getPlayerRole(player, adminProfileIds, governmentProfileIds) {
  if (adminProfileIds.has(player.id)) {
    return "admin";
  }

  if (governmentProfileIds.has(player.id)) {
    return "government";
  }

  return "player";
}

function formatPlayerRole(role) {
  const labels = {
    admin: "Admin",
    government: "Gobierno",
    player: "Jugador"
  };

  return labels[role] || role;
}

function getPlayerRoleTone(role) {
  const tones = {
    admin: "danger",
    government: "warning",
    player: "info"
  };

  return tones[role] || "neutral";
}

export default async function AdminPlayersPage({ searchParams }) {
  await requireGlobalAdminProfile("/admin/players");
  const params = await searchParams;
  const playerSearch = typeof params?.admin_player_q === "string" ? params.admin_player_q.trim() : "";
  const visibilityFilter = typeof params?.admin_player_visibility === "string" ? params.admin_player_visibility : "";
  const walletVisibilityFilter = typeof params?.admin_player_wallet === "string" ? params.admin_player_wallet : "";
  const roleFilter = typeof params?.admin_player_role === "string" ? params.admin_player_role : "";
  const selectedPlayerId = typeof params?.admin_player_id === "string" ? params.admin_player_id : "";

  const serviceSupabase = getSupabaseServiceClient();
  const [
    { data: playersData = [] },
    { data: membershipsData = [] },
    { data: propertyOwnersData = [] },
    { data: globalAdminsData = [] }
  ] = await Promise.all([
    serviceSupabase
      .from("profiles")
      .select(
        "id, gamertag, gamertag_uid, display_name, bio, public_profile, public_wallet, created_at, wallets(balance, currency_symbol)"
      )
      .order("created_at", { ascending: false }),
    serviceSupabase
      .from("organization_members")
      .select("id, profile_id, role, ownership_percent, organizations(id, name, type)")
      .order("created_at", { ascending: true }),
    serviceSupabase
      .from("property_owners")
      .select("id, profile_id, ownership_percent, properties(id, name, slug, current_value, districts(name))")
      .eq("owner_type", "profile")
      .order("created_at", { ascending: true }),
    serviceSupabase
      .from("global_admins")
      .select("profile_id")
  ]);

  const players = asArray(playersData);
  const memberships = asArray(membershipsData);
  const propertyOwners = asArray(propertyOwnersData);
  const adminProfileIds = new Set(asArray(globalAdminsData).map((admin) => admin.profile_id));
  const governmentProfileIds = new Set(
    memberships
      .filter((membership) => membership.organizations?.type === "government")
      .map((membership) => membership.profile_id)
  );
  const membershipsByProfile = new Map();
  const propertyOwnersByProfile = new Map();

  for (const membership of memberships) {
    membershipsByProfile.set(membership.profile_id, [...(membershipsByProfile.get(membership.profile_id) || []), membership]);
  }

  for (const propertyOwner of propertyOwners) {
    propertyOwnersByProfile.set(propertyOwner.profile_id, [...(propertyOwnersByProfile.get(propertyOwner.profile_id) || []), propertyOwner]);
  }

  const filteredPlayers = players.filter((player) => {
    const searchNeedle = playerSearch.toLowerCase();
    const role = getPlayerRole(player, adminProfileIds, governmentProfileIds);
    const matchesSearch =
      !searchNeedle ||
      [player.gamertag, player.gamertag_uid, player.display_name, player.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchNeedle));
    const matchesVisibility =
      !visibilityFilter ||
      (visibilityFilter === "public" && player.public_profile) ||
      (visibilityFilter === "private" && !player.public_profile);
    const matchesWalletVisibility =
      !walletVisibilityFilter ||
      (walletVisibilityFilter === "public" && player.public_wallet) ||
      (walletVisibilityFilter === "private" && !player.public_wallet);
    const matchesRole = !roleFilter || role === roleFilter;

    return matchesSearch && matchesVisibility && matchesWalletVisibility && matchesRole;
  });
  const selectedPlayer =
    players.find((player) => player.id === selectedPlayerId) ||
    filteredPlayers[0] ||
    players[0] ||
    null;
  const selectedWallet = selectedPlayer ? getWallet(selectedPlayer) : null;
  const selectedMemberships = selectedPlayer ? membershipsByProfile.get(selectedPlayer.id) || [] : [];
  const selectedPropertyOwners = selectedPlayer ? propertyOwnersByProfile.get(selectedPlayer.id) || [] : [];
  const selectedRole = selectedPlayer ? getPlayerRole(selectedPlayer, adminProfileIds, governmentProfileIds) : "player";
  const selectedSummaryItems = selectedPlayer
    ? [
        { label: "ID de perfil", value: selectedPlayer.id },
        { label: "Alta", value: formatDate(selectedPlayer.created_at) },
        { label: "Wallet", value: formatWalletBalance(selectedWallet) },
        { label: "UID", value: selectedPlayer.gamertag_uid || "Pendiente" },
        { label: "Rol especial", value: formatPlayerRole(selectedRole) },
        { label: "Organizaciones", value: selectedMemberships.length.toLocaleString("es-MX") },
        { label: "Propiedades", value: selectedPropertyOwners.length.toLocaleString("es-MX") }
      ]
    : [];
  const playerRows = filteredPlayers.map((player) => {
    const wallet = getWallet(player);
    const role = getPlayerRole(player, adminProfileIds, governmentProfileIds);

    return {
      id: player.id,
      player: (
        <div className={styles.nameCell}>
          <strong>{player.display_name || player.gamertag}</strong>
          <span>{player.gamertag}</span>
        </div>
      ),
      uid: player.gamertag_uid || "Pendiente",
      role: <Badge tone={getPlayerRoleTone(role)}>{formatPlayerRole(role)}</Badge>,
      profile: <Badge tone={player.public_profile ? "success" : "neutral"}>{player.public_profile ? "Publico" : "Privado"}</Badge>,
      wallet: (
        <div className={styles.nameCell}>
          <span>{formatWalletBalance(wallet)}</span>
          <Badge tone={player.public_wallet ? "info" : "neutral"}>{player.public_wallet ? "Publica" : "Privada"}</Badge>
        </div>
      ),
      relations: (
        <div className={styles.nameCell}>
          <span>{(membershipsByProfile.get(player.id) || []).length.toLocaleString("es-MX")} orgs</span>
          <span>{(propertyOwnersByProfile.get(player.id) || []).length.toLocaleString("es-MX")} props</span>
        </div>
      ),
      actions: (
        <CrudActionList
          actions={[
            {
              href: `/admin/players?admin_player_id=${player.id}`,
              icon: Eye,
              key: `${player.id}-detail`,
              label: "Detalle"
            },
            {
              href: `/admin/players?admin_player_id=${player.id}#admin-player-edit`,
              icon: Wrench,
              key: `${player.id}-edit`,
              label: "Editar"
            }
          ]}
          aria-label={`Acciones admin para ${player.gamertag}`}
        />
      )
    };
  });
  const membershipRows = selectedMemberships.map((membership) => ({
    id: membership.id,
    organization: (
      <div className={styles.nameCell}>
        <strong>{membership.organizations?.name || "Organizacion no disponible"}</strong>
        <span>{membership.organizations?.type === "government" ? "Gobierno" : "Privada"}</span>
      </div>
    ),
    role: membership.role || "Miembro",
    percent: `${Number(membership.ownership_percent || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`
  }));
  const propertyRows = selectedPropertyOwners.map((owner) => ({
    id: owner.id,
    property: (
      <div className={styles.nameCell}>
        <strong>{owner.properties?.name || "Propiedad no disponible"}</strong>
        <span>{owner.properties?.districts?.name || "Sin delegacion"}</span>
      </div>
    ),
    percent: `${Number(owner.ownership_percent || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`,
    value: formatWalletBalance({ balance: owner.properties?.current_value || 0, currency_symbol: "CC$" }),
    action: owner.properties?.slug ? (
      <LinkButton href={`/properties/${owner.properties.slug}`} icon={Eye} size="sm" variant="secondary">
        Detalle
      </LinkButton>
    ) : (
      "No disponible"
    )
  }));

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

      <CrudLayout>
        <CrudToolbar
          filters={[
            {
              defaultValue: visibilityFilter,
              label: "Perfil",
              name: "admin_player_visibility",
              options: [
                { label: "Todos", value: "" },
                { label: "Publicos", value: "public" },
                { label: "Privados", value: "private" }
              ]
            },
            {
              defaultValue: walletVisibilityFilter,
              label: "Wallet",
              name: "admin_player_wallet",
              options: [
                { label: "Todas", value: "" },
                { label: "Publicas", value: "public" },
                { label: "Privadas", value: "private" }
              ]
            },
            {
              defaultValue: roleFilter,
              label: "Rol",
              name: "admin_player_role",
              options: [
                { label: "Todos", value: "" },
                { label: "Admin", value: "admin" },
                { label: "Gobierno", value: "government" },
                { label: "Jugador", value: "player" }
              ]
            }
          ]}
          searchDefaultValue={playerSearch}
          searchLabel="Buscar jugador"
          searchName="admin_player_q"
          searchPlaceholder="Gamertag, UID, nombre visible o ID"
        />

        {players.length ? (
          <CrudWorkspace
            sidebar={
              selectedPlayer ? (
                <CrudPanel title="Edicion de perfil">
                  <div id="admin-player-edit" className={styles.anchorTarget}>
                    <SectionHeader
                      eyebrow="Admin"
                      title={selectedPlayer.gamertag}
                      description="Edita datos administrativos permitidos. Cada cambio queda auditado."
                    />
                    <AdminPlayerForm player={selectedPlayer} />
                  </div>
                </CrudPanel>
              ) : null
            }
          >
            <Card className={styles.playerCard}>
              <SectionHeader
                eyebrow="CRUD centralizado"
                title="Usuarios y jugadores"
                description={`${filteredPlayers.length.toLocaleString("es-MX")} de ${players.length.toLocaleString("es-MX")} perfiles segun filtros activos.`}
              />
              {playerRows.length ? (
                <Table
                  columns={[
                    { key: "player", label: "Jugador" },
                    { key: "uid", label: "UID" },
                    { key: "role", label: "Rol" },
                    { key: "profile", label: "Perfil" },
                    { key: "wallet", label: "Wallet" },
                    { key: "relations", label: "Relaciones" },
                    { key: "actions", label: "Acciones" }
                  ]}
                  getRowKey={(row) => row.id}
                  rows={playerRows}
                />
              ) : (
                <EmptyState
                  description="No hay jugadores que coincidan con los filtros activos."
                  icon={UsersRound}
                  title="Sin resultados"
                />
              )}
            </Card>

            {selectedPlayer ? (
              <Card className={styles.playerCard}>
                <div className={styles.playerHeader}>
                  <div>
                    <span>
                      <UserRoundCog size={18} />
                      Jugador seleccionado
                    </span>
                    <h2>{selectedPlayer.display_name || selectedPlayer.gamertag}</h2>
                  </div>
                  <div className={styles.badges}>
                    <Badge tone={getPlayerRoleTone(selectedRole)}>{formatPlayerRole(selectedRole)}</Badge>
                    <Badge tone={selectedPlayer.public_profile ? "success" : "neutral"}>
                      {selectedPlayer.public_profile ? "Perfil publico" : "Perfil privado"}
                    </Badge>
                    <Badge tone={selectedPlayer.public_wallet ? "info" : "neutral"}>
                      {selectedPlayer.public_wallet ? "Wallet publica" : "Wallet privada"}
                    </Badge>
                  </div>
                </div>

                <div className={styles.playerGrid}>
                  <div>
                    <SectionHeader
                      eyebrow="Resumen"
                      title={selectedPlayer.gamertag}
                      description="Datos operativos del perfil, rol y wallet."
                    />
                    <DataList items={selectedSummaryItems} />
                  </div>
                  <div>
                    <SectionHeader
                      eyebrow="Organizaciones"
                      title="Participacion"
                      description="Relaciones visibles para auditoria administrativa."
                    />
                    {membershipRows.length ? (
                      <Table
                        columns={[
                          { key: "organization", label: "Organizacion" },
                          { key: "role", label: "Rol" },
                          { key: "percent", label: "%" }
                        ]}
                        getRowKey={(row) => row.id}
                        rows={membershipRows}
                      />
                    ) : (
                      <EmptyState
                        description="Este jugador no pertenece a organizaciones."
                        icon={ShieldCheck}
                        title="Sin organizaciones"
                      />
                    )}
                  </div>
                </div>

                <div className={styles.relationsBlock}>
                  <SectionHeader
                    eyebrow="Propiedades"
                    title="Participaciones inmobiliarias"
                    description="Propiedades donde el jugador aparece como propietario directo."
                  />
                  {propertyRows.length ? (
                    <Table
                      columns={[
                        { key: "property", label: "Propiedad" },
                        { key: "percent", label: "%" },
                        { key: "value", label: "Valor" },
                        { key: "action", label: "Detalle" }
                      ]}
                      getRowKey={(row) => row.id}
                      rows={propertyRows}
                    />
                  ) : (
                    <EmptyState
                      description="Este jugador no tiene propiedades directas registradas."
                      icon={WalletCards}
                      title="Sin propiedades"
                    />
                  )}
                </div>
              </Card>
            ) : null}
          </CrudWorkspace>
        ) : (
          <Card className={styles.emptyCard}>
            <EmptyState
              description="Cuando existan usuarios autenticados, sus perfiles apareceran aqui para gestion administrativa."
              icon={UsersRound}
              title="No hay jugadores registrados"
            />
          </Card>
        )}
      </CrudLayout>

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
