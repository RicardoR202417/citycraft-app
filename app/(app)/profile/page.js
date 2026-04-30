import { ArrowLeft } from "lucide-react";
import { Card, DataList, LinkButton, PageHeader, SectionHeader } from "../../../components/ui";
import { getProfileVisibility, requireProfile } from "../../../lib/auth";
import { ProfileIdentityForm } from "./ProfileIdentityForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Perfil - CityCraft App"
};

export default async function ProfilePage() {
  const profile = await requireProfile("/profile");
  const visibility = getProfileVisibility(profile);

  const visibilityItems = [
    { label: "Perfil publico", value: visibility.profile ? "Visible" : "Privado" },
    { label: "Gamertag publico", value: visibility.gamertag ? "Visible" : "Privado" },
    { label: "UID publico", value: visibility.gamertag_uid ? "Visible" : "Privado" },
    { label: "Billetera publica", value: visibility.wallet ? "Visible" : "Privada" }
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Administra la identidad que conecta tu perfil de la plataforma con tu jugador dentro del Realm."
        eyebrow="Perfil privado"
        title="Identidad de jugador"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            description="Estos datos se usan para asistencia, propiedades y actividad economica."
            eyebrow="Minecraft Bedrock"
            title="Gamertag y UID"
          />
          <ProfileIdentityForm profile={profile} />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            description="La visibilidad granular se gestionara en una historia posterior."
            eyebrow="Privacidad"
            title="Estado de visibilidad"
          />
          <DataList items={visibilityItems} />
        </Card>
      </section>
    </main>
  );
}
