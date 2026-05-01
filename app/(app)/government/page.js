import { ArrowLeft, Building2, CalendarCheck, ClipboardCheck, Landmark, LandPlot, MapPinned, Scale } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireGovernmentProfile } from "../../../lib/auth";
import { formatMoney } from "../../../lib/economy";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
import { AttendanceForm } from "./AttendanceForm";
import { DistrictForm } from "./DistrictForm";
import { FineForm } from "./FineForm";
import { PermitDecisionForm } from "./PermitDecisionForm";
import { PropertyForm } from "./PropertyForm";
import { UnownedLandDispositionForm, UnownedLandForm } from "./UnownedLandForms";
import { ValuationForm } from "./ValuationForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Gobierno - CityCraft App"
};

function formatRate(value) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  })}%`;
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

function formatPropertyStatus(status) {
  const labels = {
    active: "Activa",
    archived: "Archivada",
    demolished: "Demolida",
    planned: "Planeada",
    under_review: "En revision"
  };

  return labels[status] || status;
}

function getStatusTone(status) {
  const tones = {
    active: "success",
    archived: "neutral",
    demolished: "danger",
    planned: "info",
    under_review: "warning"
  };

  return tones[status] || "neutral";
}

function formatLandDisposition(disposition) {
  const labels = {
    available: "Disponible",
    for_auction: "En subasta",
    for_sale: "En venta",
    reserved: "Reservada"
  };

  return labels[disposition] || "Sin definir";
}

function getLandDispositionTone(disposition) {
  const tones = {
    available: "success",
    for_auction: "warning",
    for_sale: "info",
    reserved: "neutral"
  };

  return tones[disposition] || "neutral";
}

function formatRequestType(type) {
  const labels = {
    construction: "Construccion",
    demolition: "Demolicion",
    modification: "Modificacion"
  };

  return labels[type] || type;
}

function formatPermitStatus(status) {
  const labels = {
    approved: "Aprobada",
    pending: "Pendiente",
    rejected: "Rechazada"
  };

  return labels[status] || status;
}

function getPermitStatusTone(status) {
  const tones = {
    approved: "success",
    pending: "warning",
    rejected: "danger"
  };

  return tones[status] || "neutral";
}

function formatFineStatus(status) {
  const labels = {
    debt: "Adeudo",
    paid: "Cobrada"
  };

  return labels[status] || status;
}

function getFineStatusTone(status) {
  const tones = {
    debt: "warning",
    paid: "success"
  };

  return tones[status] || "neutral";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
  }).format(new Date(`${value}T00:00:00`));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function GovernmentPage() {
  await requireGovernmentProfile("/government");
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();

  const { data: districtsData } = await supabase
    .from("districts")
    .select("id, name, slug, description, base_appreciation_rate, created_at")
    .order("name", { ascending: true });

  const { data: propertiesData } = await supabase.from("properties").select("id, name, district_id, parent_property_id");

  const { data: propertyRowsData } = await supabase
    .from("properties")
    .select("id, name, address, type, size_blocks, current_value, parent_property_id, districts(name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: parentPropertiesData } = await supabase
    .from("properties")
    .select("id, name, districts(name)")
    .is("parent_property_id", null)
    .order("name", { ascending: true });

  const { data: unownedLandsData } = await supabase
    .from("properties")
    .select(
      "id, name, address, status, size_blocks, current_value, government_disposition, created_at, districts(name), property_owners(id)"
    )
    .eq("type", "land")
    .not("government_disposition", "is", null)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: valuationsData } = await supabase
    .from("property_valuations")
    .select("id, value, reason, created_at, properties(id, name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: attendanceData } = await supabase
    .from("attendance_records")
    .select("id, profile_id, recorded_by, attendance_date, minutes_played, is_valid, notes, created_at")
    .order("attendance_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: payoutsData } = await supabase
    .from("daily_payouts")
    .select("id, profile_id, payout_date, gross_property_value, payout_rate, payout_amount, ledger_entry_id, created_at")
    .order("payout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: organizationPayoutsData } = await supabase
    .from("organization_daily_payouts")
    .select(
      "id, organization_id, profile_id, payout_date, gross_property_value, payout_rate, attendance_ownership_percent, payout_amount, ledger_entry_id, organizations(name), profiles!organization_daily_payouts_profile_id_fkey(gamertag)"
    )
    .order("payout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: permitRequestsData } = await serviceSupabase
    .from("property_permit_requests")
    .select(
      "id, property_id, requested_by_profile_id, request_type, title, description, proposed_type, proposed_size_blocks, proposed_value, status, government_comment, created_at, decided_at, properties(name, type, size_blocks, current_value, districts(name)), profiles!property_permit_requests_requested_by_profile_id_fkey(gamertag, display_name)"
    )
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: finesData } = await serviceSupabase
    .from("government_fines")
    .select(
      "id, target_type, amount, paid_amount, outstanding_amount, status, reason, created_at, ledger_entry_id, profiles!government_fines_target_profile_id_fkey(gamertag, display_name), organizations!government_fines_target_organization_id_fkey(name, type)"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: profilesData } = await serviceSupabase
    .from("profiles")
    .select("id, gamertag")
    .order("gamertag", { ascending: true });

  const { data: organizationsData } = await serviceSupabase
    .from("organizations")
    .select("id, name, type")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  const districts = asArray(districtsData);
  const properties = asArray(propertiesData);
  const propertyRows = asArray(propertyRowsData);
  const parentProperties = asArray(parentPropertiesData);
  const unownedLands = asArray(unownedLandsData).filter((land) => !asArray(land.property_owners).length);
  const valuations = asArray(valuationsData);
  const attendanceRecords = asArray(attendanceData);
  const dailyPayouts = asArray(payoutsData);
  const organizationPayouts = asArray(organizationPayoutsData);
  const permitRequests = asArray(permitRequestsData);
  const fines = asArray(finesData);
  const profiles = asArray(profilesData);
  const organizations = asArray(organizationsData);
  const fineTargetOrganizations = organizations.filter((organization) => organization.type !== "government");
  const propertyNameById = new Map(properties.map((property) => [property.id, property.name]));
  const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.gamertag]));

  const unitCount = properties.filter((property) => property.parent_property_id).length;
  const matrixCount = properties.length - unitCount;
  const marketReadyLandCount = unownedLands.filter((land) =>
    ["for_sale", "for_auction"].includes(land.government_disposition)
  ).length;
  const pendingPermitCount = permitRequests.filter((request) => request.status === "pending").length;
  const debtFineTotal = fines
    .filter((fine) => fine.status === "debt")
    .reduce((total, fine) => total + Number(fine.outstanding_amount || 0), 0);

  const propertyCountByDistrict = properties.reduce((counts, property) => {
    counts[property.district_id] = (counts[property.district_id] || 0) + 1;
    return counts;
  }, {});

  const rows = districts.map((district) => ({
    id: district.id,
    name: (
      <div className={styles.districtName}>
        <strong>{district.name}</strong>
        <span>{district.slug}</span>
      </div>
    ),
    appreciation: formatRate(district.base_appreciation_rate),
    properties: (
      <Badge tone={propertyCountByDistrict[district.id] ? "info" : "neutral"}>
        {propertyCountByDistrict[district.id] || 0}
      </Badge>
    ),
    description: district.description || "Sin descripcion"
  }));

  const propertyTableRows = propertyRows.map((property) => ({
    id: property.id,
    name: (
      <div className={styles.districtName}>
        <strong>{property.name}</strong>
        <span>{property.address}</span>
      </div>
    ),
    district: property.districts?.name || "Sin delegacion",
    type: <Badge tone="info">{formatPropertyType(property.type)}</Badge>,
    kind: (
      <Badge tone={property.parent_property_id ? "warning" : "success"}>
        {property.parent_property_id ? "Unidad privativa" : "Matriz"}
      </Badge>
    ),
    parent: property.parent_property_id ? propertyNameById.get(property.parent_property_id) || "Matriz no disponible" : "No aplica",
    size: Number(property.size_blocks).toLocaleString("es-MX"),
    value: formatMoney(property.current_value)
  }));

  const unownedLandRows = unownedLands.map((land) => ({
    id: land.id,
    name: (
      <div className={styles.districtName}>
        <strong>{land.name}</strong>
        <span>{land.address}</span>
      </div>
    ),
    district: land.districts?.name || "Sin delegacion",
    disposition: (
      <Badge tone={getLandDispositionTone(land.government_disposition)}>
        {formatLandDisposition(land.government_disposition)}
      </Badge>
    ),
    status: <Badge tone={getStatusTone(land.status)}>{formatPropertyStatus(land.status)}</Badge>,
    size: Number(land.size_blocks).toLocaleString("es-MX"),
    value: formatMoney(land.current_value),
    update: <UnownedLandDispositionForm land={land} />
  }));

  const valuationRows = valuations.map((valuation) => ({
    id: valuation.id,
    property: valuation.properties?.name || "Propiedad no disponible",
    value: formatMoney(valuation.value),
    reason: valuation.reason,
    createdAt: formatDate(valuation.created_at)
  }));

  const attendanceRows = attendanceRecords.map((record) => ({
    id: record.id,
    player: profileNameById.get(record.profile_id) || "Jugador no disponible",
    day: formatDay(record.attendance_date),
    minutes: `${record.minutes_played} min`,
    status: <Badge tone={record.is_valid ? "success" : "warning"}>{record.is_valid ? "Valida" : "No valida"}</Badge>,
    recordedBy: profileNameById.get(record.recorded_by) || "Gobierno",
    notes: record.notes || "Sin notas"
  }));

  const payoutRows = dailyPayouts.map((payout) => ({
    id: payout.id,
    player: profileNameById.get(payout.profile_id) || "Jugador no disponible",
    day: formatDay(payout.payout_date),
    grossValue: formatMoney(payout.gross_property_value),
    rate: formatPayoutRate(payout.payout_rate),
    amount: formatMoney(payout.payout_amount),
    ledger: (
      <Badge tone={payout.ledger_entry_id ? "success" : "neutral"}>
        {payout.ledger_entry_id ? "Con ledger" : "Pago cero"}
      </Badge>
    )
  }));

  const organizationPayoutRows = organizationPayouts.map((payout) => ({
    id: payout.id,
    organization: payout.organizations?.name || "Organizacion no disponible",
    player: payout.profiles?.gamertag || profileNameById.get(payout.profile_id) || "Jugador no disponible",
    day: formatDay(payout.payout_date),
    grossValue: formatMoney(payout.gross_property_value),
    rate: formatPayoutRate(payout.payout_rate),
    attendanceShare: `${Number(payout.attendance_ownership_percent || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`,
    amount: formatMoney(payout.payout_amount),
    ledger: (
      <Badge tone={payout.ledger_entry_id ? "success" : "neutral"}>
        {payout.ledger_entry_id ? "Con ledger" : "Pago cero"}
      </Badge>
    )
  }));

  const permitRows = permitRequests.map((request) => ({
    id: request.id,
    request: (
      <div className={styles.districtName}>
        <strong>{request.title}</strong>
        <span>{request.properties?.name || "Propiedad no disponible"}</span>
      </div>
    ),
    requester: request.profiles?.display_name || request.profiles?.gamertag || "Jugador no disponible",
    type: <Badge tone="info">{formatRequestType(request.request_type)}</Badge>,
    status: <Badge tone={getPermitStatusTone(request.status)}>{formatPermitStatus(request.status)}</Badge>,
    proposed: (
      <div className={styles.districtName}>
        <span>{request.proposed_type ? `Tipo: ${formatPropertyType(request.proposed_type)}` : "Tipo: sin cambio"}</span>
        <span>
          {request.proposed_size_blocks
            ? `Bloques: ${Number(request.proposed_size_blocks).toLocaleString("es-MX")}`
            : "Bloques: sin cambio"}
        </span>
        <span>{request.proposed_value !== null ? `Valor: ${formatMoney(request.proposed_value)}` : "Valor: sin cambio"}</span>
      </div>
    ),
    description: request.description,
    comment: request.government_comment || "Pendiente",
    createdAt: formatDate(request.created_at),
    decision: request.status === "pending" ? <PermitDecisionForm request={request} /> : formatDate(request.decided_at)
  }));

  const fineRows = fines.map((fine) => {
    const target =
      fine.target_type === "profile"
        ? fine.profiles?.display_name || fine.profiles?.gamertag || "Jugador no disponible"
        : fine.organizations?.name || "Organizacion no disponible";

    return {
      id: fine.id,
      target: (
        <div className={styles.districtName}>
          <strong>{target}</strong>
          <span>{fine.target_type === "profile" ? "Jugador" : "Organizacion"}</span>
        </div>
      ),
      status: <Badge tone={getFineStatusTone(fine.status)}>{formatFineStatus(fine.status)}</Badge>,
      amount: formatMoney(fine.amount),
      paid: formatMoney(fine.paid_amount),
      debt: formatMoney(fine.outstanding_amount),
      reason: fine.reason,
      ledger: (
        <Badge tone={fine.ledger_entry_id ? "success" : "warning"}>
          {fine.ledger_entry_id ? "Con ledger" : "Adeudo sin cobro"}
        </Badge>
      ),
      createdAt: formatDate(fine.created_at)
    };
  });

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Administracion inicial de delegaciones, registro inmobiliario y datos publicos del gobierno."
        eyebrow="Gobierno"
        title="Registro territorial"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Delegaciones"
            title="Nueva delegacion"
            description="Cada propiedad debe pertenecer a una zona para habilitar reportes y plusvalia futura."
          />
          <DistrictForm />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Resumen"
            title="Cobertura territorial"
            description="Lectura rapida del estado inicial de la ciudad registrada."
          />
          <div className={styles.stats}>
            <article>
              <MapPinned size={20} />
              <strong>{districts.length}</strong>
              <span>Delegaciones</span>
            </article>
            <article>
              <Building2 size={20} />
              <strong>{matrixCount}</strong>
              <span>Propiedades matriz</span>
            </article>
            <article>
              <Building2 size={20} />
              <strong>{unitCount}</strong>
              <span>Unidades privativas</span>
            </article>
            <article>
              <LandPlot size={20} />
              <strong>{unownedLands.length}</strong>
              <span>Tierras sin dueño</span>
            </article>
            <article>
              <Landmark size={20} />
              <strong>{marketReadyLandCount}</strong>
              <span>Listas para mercado</span>
            </article>
            <article>
              <ClipboardCheck size={20} />
              <strong>{pendingPermitCount}</strong>
              <span>Permisos pendientes</span>
            </article>
            <article>
              <Scale size={20} />
              <strong>{formatMoney(debtFineTotal)}</strong>
              <span>Adeudos por multas</span>
            </article>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Propiedades"
          title="Nueva propiedad"
          description="El registro crea propiedad, propietario inicial y valoracion inicial en una sola operacion."
        />
        <PropertyForm
          districts={districts}
          organizations={organizations}
          parentProperties={parentProperties}
          profiles={profiles}
        />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Tierras sin dueño"
          title="Registrar tierra gubernamental"
          description="Alta de terrenos sin propietario administrados por el gobierno para reservar, vender o subastar."
        />
        <UnownedLandForm districts={districts} />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Valoracion"
          title="Nueva valoracion"
          description="Cada ajuste crea un registro historico y actualiza el valor vigente de la propiedad."
        />
        <ValuationForm properties={propertyRows} />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Asistencia"
          title="Registrar asistencia diaria"
          description="Marca jugadores con al menos 30 minutos registrados en la linea de tiempo del Realm."
        />
        <AttendanceForm profiles={profiles} />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Multas"
          title="Aplicar multa"
          description="El gobierno puede multar jugadores u organizaciones. Si hay saldo suficiente, se cobra y se transfiere al gobierno; si no, queda como adeudo."
        />
        <FineForm organizations={fineTargetOrganizations} profiles={profiles} />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Directorio"
          title="Delegaciones registradas"
          description="Listado administrativo con conteo de propiedades por zona."
        />
        {districts.length ? (
          <Table
            columns={[
              { key: "name", label: "Delegacion" },
              { key: "appreciation", label: "Plusvalia base" },
              { key: "properties", label: "Propiedades" },
              { key: "description", label: "Descripcion" }
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : (
          <EmptyState
            description="Registra la primera delegacion para empezar a ubicar propiedades."
            icon={Landmark}
            title="Sin delegaciones"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Registro inmobiliario"
          title="Propiedades recientes"
          description="Listado administrativo de las ultimas propiedades registradas."
        />
        {propertyRows.length ? (
          <Table
            columns={[
              { key: "name", label: "Propiedad" },
              { key: "district", label: "Delegacion" },
              { key: "type", label: "Tipo" },
              { key: "kind", label: "Registro" },
              { key: "parent", label: "Matriz" },
              { key: "size", label: "Bloques" },
              { key: "value", label: "Valor" }
            ]}
            getRowKey={(row) => row.id}
            rows={propertyTableRows}
          />
        ) : (
          <EmptyState
            description="Cuando registres propiedades, apareceran aqui con su delegacion, tipo y valor actual."
            icon={Building2}
            title="Sin propiedades registradas"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Gobierno"
          title="Tierras sin dueño"
          description="Inventario operativo de terrenos sin propietarios. Cambiar a venta o subasta deja auditoria."
        />
        {unownedLands.length ? (
          <Table
            columns={[
              { key: "name", label: "Tierra" },
              { key: "district", label: "Delegacion" },
              { key: "disposition", label: "Disponibilidad" },
              { key: "status", label: "Estado" },
              { key: "size", label: "Bloques" },
              { key: "value", label: "Valor" },
              { key: "update", label: "Gestion" }
            ]}
            getRowKey={(row) => row.id}
            rows={unownedLandRows}
          />
        ) : (
          <EmptyState
            description="Registra tierras sin dueño para que el gobierno pueda reservarlas, venderlas o subastarlas."
            icon={LandPlot}
            title="Sin tierras sin dueño"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Permisos"
          title="Solicitudes de construccion y modificacion"
          description="Revisa solicitudes de jugadores. Al aprobar, el sistema puede aplicar tipo, tamano, valor o demolicion sobre la propiedad."
        />
        {permitRows.length ? (
          <Table
            columns={[
              { key: "request", label: "Solicitud" },
              { key: "requester", label: "Solicitante" },
              { key: "type", label: "Tipo" },
              { key: "status", label: "Estado" },
              { key: "proposed", label: "Propuesta" },
              { key: "description", label: "Descripcion" },
              { key: "comment", label: "Comentario" },
              { key: "createdAt", label: "Creada" },
              { key: "decision", label: "Decision" }
            ]}
            getRowKey={(row) => row.id}
            rows={permitRows}
          />
        ) : (
          <EmptyState
            description="Cuando un jugador solicite construir, modificar o demoler una propiedad, aparecera aqui."
            icon={ClipboardCheck}
            title="Sin solicitudes de permiso"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Multas"
          title="Multas recientes"
          description="Historial de multas aplicadas por el gobierno, con cobro inmediato o adeudo por saldo insuficiente."
        />
        {fineRows.length ? (
          <Table
            columns={[
              { key: "target", label: "Destinatario" },
              { key: "status", label: "Estado" },
              { key: "amount", label: "Monto" },
              { key: "paid", label: "Cobrado" },
              { key: "debt", label: "Adeudo" },
              { key: "reason", label: "Razon" },
              { key: "ledger", label: "Ledger" },
              { key: "createdAt", label: "Fecha" }
            ]}
            getRowKey={(row) => row.id}
            rows={fineRows}
          />
        ) : (
          <EmptyState
            description="Cuando el gobierno aplique multas, apareceran aqui con su estado economico."
            icon={Scale}
            title="Sin multas registradas"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Historial"
          title="Valoraciones recientes"
          description="Historial auditable de cambios de valor. Los registros no se editan; se agrega una nueva valoracion."
        />
        {valuations.length ? (
          <Table
            columns={[
              { key: "property", label: "Propiedad" },
              { key: "value", label: "Valor" },
              { key: "reason", label: "Razon" },
              { key: "createdAt", label: "Fecha" }
            ]}
            getRowKey={(row) => row.id}
            rows={valuationRows}
          />
        ) : (
          <EmptyState
            description="Las propiedades nuevas ya generan una valoracion inicial; los cambios posteriores apareceran aqui."
            icon={Landmark}
            title="Sin valoraciones"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Asistencia"
          title="Asistencias recientes"
          description="Historial administrativo de asistencias validas registradas por el gobierno."
        />
        {attendanceRecords.length ? (
          <Table
            columns={[
              { key: "player", label: "Jugador" },
              { key: "day", label: "Fecha" },
              { key: "minutes", label: "Tiempo" },
              { key: "status", label: "Estado" },
              { key: "recordedBy", label: "Registro" },
              { key: "notes", label: "Notas" }
            ]}
            getRowKey={(row) => row.id}
            rows={attendanceRows}
          />
        ) : (
          <EmptyState
            description="Cuando marques asistencia de jugadores, el historial reciente aparecera aqui."
            icon={CalendarCheck}
            title="Sin asistencias registradas"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Economia"
          title="Pagos diarios recientes"
          description="Auditoria operativa de pagos directos generados a jugadores por asistencia valida."
        />
        {dailyPayouts.length ? (
          <Table
            columns={[
              { key: "player", label: "Jugador" },
              { key: "day", label: "Fecha" },
              { key: "grossValue", label: "Valor base" },
              { key: "rate", label: "Tasa" },
              { key: "amount", label: "Pago" },
              { key: "ledger", label: "Ledger" }
            ]}
            getRowKey={(row) => row.id}
            rows={payoutRows}
          />
        ) : (
          <EmptyState
            description="Los pagos apareceran aqui cuando se registre una asistencia valida con rendimiento directo."
            icon={Landmark}
            title="Sin pagos diarios"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Organizaciones"
          title="Pagos proporcionales recientes"
          description="Pagos generados a organizaciones segun el porcentaje del socio que asistio."
        />
        {organizationPayouts.length ? (
          <Table
            columns={[
              { key: "organization", label: "Organizacion" },
              { key: "player", label: "Socio asistente" },
              { key: "day", label: "Fecha" },
              { key: "grossValue", label: "Valor base org." },
              { key: "rate", label: "Tasa" },
              { key: "attendanceShare", label: "% socio" },
              { key: "amount", label: "Pago" },
              { key: "ledger", label: "Ledger" }
            ]}
            getRowKey={(row) => row.id}
            rows={organizationPayoutRows}
          />
        ) : (
          <EmptyState
            description="Cuando un socio con participacion registre asistencia, aqui aparecera el pago proporcional a la organizacion."
            icon={Landmark}
            title="Sin pagos a organizaciones"
          />
        )}
      </Card>
    </main>
  );
}
