import { ArrowLeft, Building2, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, DataList, LinkButton, PageHeader, SectionHeader } from "../../../../components/ui";
import { formatPublicPropertyType, getPublicPropertyBySlug } from "../../../../lib/properties/publicProperties";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata = {
  title: "Propiedad publica - CityCraft App"
};

function formatArea(value) {
  return `${Number(value || 0).toLocaleString("es-MX")} bloques`;
}

export default async function PublicPropertyPage({ params }) {
  const { slug } = await params;
  const property = await getPublicPropertyBySlug(slug);

  if (!property) {
    notFound();
  }

  const details = [
    { label: "Tipo", value: formatPublicPropertyType(property.type) },
    { label: "Delegacion", value: property.district_name },
    { label: "Direccion", value: property.address || "Sin direccion publica" },
    { label: "Tamano aproximado", value: formatArea(property.size_blocks) }
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/" icon={ArrowLeft} variant="secondary">
            Foro
          </LinkButton>
        }
        description="Vista publica con informacion basica. No muestra propietarios, valores ni datos privados."
        eyebrow="Propiedad publica"
        title={property.name}
      />

      <section className={styles.grid}>
        <Card className={styles.heroCard}>
          <span className={styles.icon}>
            <ShieldCheck size={28} />
          </span>
          <Badge tone="info">{formatPublicPropertyType(property.type)}</Badge>
          <p>{property.excerpt}</p>
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            description="Datos seguros para visitantes."
            eyebrow="Resumen"
            title="Informacion visible"
          />
          <DataList items={details} />
        </Card>
      </section>

      <section className={styles.links} aria-label="Explorar mas">
        <Link href="/constructions">
          <Building2 size={19} />
          <span>
            <strong>Foro publico</strong>
            <small>Ver publicaciones y avances compartidos.</small>
          </span>
        </Link>
        <Link href="/districts">
          <MapPinned size={19} />
          <span>
            <strong>Delegaciones</strong>
            <small>Explorar zonas de la ciudad.</small>
          </span>
        </Link>
      </section>
    </main>
  );
}
