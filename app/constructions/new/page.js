import { ArrowLeft, Eye, ImagePlus, Lock, MapPinned } from "lucide-react";
import { Badge, Card, DataList, LinkButton, PageHeader, SectionHeader } from "../../../components/ui";
import { requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { ConstructionPostForm } from "./ConstructionPostForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Publicar construccion - CityCraft App"
};

function buildPropertyOptions(propertyOwners) {
  const optionsById = new Map();

  propertyOwners.forEach((owner) => {
    const property = owner.properties;

    if (!property?.id || optionsById.has(property.id)) {
      return;
    }

    optionsById.set(property.id, {
      id: property.id,
      label: `${property.name}${property.address ? ` - ${property.address}` : ""}`
    });
  });

  return Array.from(optionsById.values());
}

export default async function NewConstructionPostPage() {
  const profile = await requireProfile("/constructions/new");
  const supabase = await createSupabaseServerClient();

  const { data: districts = [], error: districtsError } = await supabase
    .from("districts")
    .select("id, name")
    .order("name", { ascending: true });

  if (districtsError) {
    throw new Error(`Could not load districts: ${districtsError.message}`);
  }

  const { data: propertyOwners = [], error: propertiesError } = await supabase
    .from("property_owners")
    .select("properties(id, name, address)")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(80);

  if (propertiesError) {
    throw new Error(`Could not load player properties: ${propertiesError.message}`);
  }

  const propertyOptions = buildPropertyOptions(propertyOwners);
  const summaryItems = [
    { label: "Autor", value: profile.display_name || profile.gamertag },
    { label: "Delegaciones disponibles", value: districts.length.toLocaleString("es-MX") },
    { label: "Propiedades propias", value: propertyOptions.length.toLocaleString("es-MX") }
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/constructions" icon={ArrowLeft} variant="secondary">
            Feed publico
          </LinkButton>
        }
        description="Registra una construccion del Realm con titulo, descripcion, imagen y visibilidad. Si la marcas publica, aparece en el feed de exposicion."
        eyebrow="Foro de construcciones"
        title="Publicar construccion"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            description="Las publicaciones publicas usan imagenes aprobadas y datos visibles del perfil. Las privadas quedan guardadas para trabajo futuro de perfil."
            eyebrow="Contexto"
            title="Datos de publicacion"
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.rulesCard}>
          <Badge tone="success">Publica</Badge>
          <div>
            <Eye size={20} />
            <span>Aparece en el feed anonimo con imagen firmada y autor visible.</span>
          </div>
          <div>
            <Lock size={20} />
            <span>Privada queda registrada sin exponerse a visitantes.</span>
          </div>
          <div>
            <MapPinned size={20} />
            <span>La delegacion y propiedad son opcionales para no frenar avances del Realm.</span>
          </div>
        </Card>
      </section>

      <Card className={styles.formCard}>
        <SectionHeader
          description="Mantén la descripcion clara: qué es, dónde está y por qué importa dentro de la ciudad."
          eyebrow="Nueva publicacion"
          title="Contenido"
        />
        <ConstructionPostForm districtOptions={districts} propertyOptions={propertyOptions} />
      </Card>

      <Card className={styles.noteCard}>
        <ImagePlus size={22} />
        <p>
          Las imagenes se guardan en el bucket privado de Supabase. Solo se usan en el feed cuando la publicacion y el
          archivo quedan marcados como publicos.
        </p>
      </Card>
    </main>
  );
}
