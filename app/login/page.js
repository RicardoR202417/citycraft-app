import { redirect } from "next/navigation";
import { Card } from "../../components/ui";
import { getCurrentUser } from "../../lib/auth";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Iniciar sesion - CityCraft App"
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p>CityCraft App</p>
        <h1>Acceso de jugadores</h1>
        <span>
          Entra para administrar tu perfil, billetera, propiedades y
          organizaciones dentro del Realm.
        </span>
      </section>

      <Card className={styles.card}>
        <LoginForm />
      </Card>
    </main>
  );
}
