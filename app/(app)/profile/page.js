import { ArrowLeft } from "lucide-react";
import { Card, LinkButton, PageHeader, SectionHeader } from "../../../components/ui";
import { getProfileVisibility, requireProfile } from "../../../lib/auth";
import { ProfileIdentityForm } from "./ProfileIdentityForm";
import { ProfileVisibilityForm } from "./ProfileVisibilityForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Perfil - CityCraft App"
};

export default async function ProfilePage() {
  const profile = await requireProfile("/profile");
  const visibility = getProfileVisibility(profile);

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
            description="Elige que partes de tu perfil pueden aparecer en vistas publicas."
            eyebrow="Privacidad"
            title="Visibilidad publica"
          />
          <ProfileVisibilityForm visibility={visibility} />
        </Card>
      </section>
    </main>
  );
}
