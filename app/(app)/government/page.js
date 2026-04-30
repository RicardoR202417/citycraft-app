import { ArrowLeft, Building2, CalendarCheck, Landmark, MapPinned } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireGovernmentProfile } from "../../../lib/auth";
import { formatMoney } from "../../../lib/economy";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
import { AttendanceForm } from "./AttendanceForm";
import { DistrictForm } from "./DistrictForm";
import { PropertyForm } from "./PropertyForm";
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
  const valuations = asArray(valuationsData);
  const attendanceRecords = asArray(attendanceData);
  const dailyPayouts = asArray(payoutsData);
  const profiles = asArray(profilesData);
  const organizations = asArray(organizationsData);
  const propertyNameById = new Map(properties.map((property) => [property.id, property.name]));
  const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.gamertag]));

  const unitCount = properties.filter((property) => property.parent_property_id).length;
  const matrixCount = properties.length - unitCount;

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
          description="Auditoria operativa de pagos generados al registrar asistencias validas."
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
    </main>
  );
}
