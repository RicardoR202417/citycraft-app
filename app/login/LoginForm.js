"use client";

import { LogIn, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "../../components/ui";
import { normalizeRedirectPath } from "../../lib/auth/routes";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gamertag, setGamertag] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") === "auth_callback"
      ? "No se pudo completar la autenticacion. Intenta iniciar sesion nuevamente."
      : ""
  );
  const [isLoading, setIsLoading] = useState(false);

  const nextPath = normalizeRedirectPath(searchParams.get("next"));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    const supabase = getSupabaseBrowserClient();
    const cleanEmail = email.trim();
    const cleanGamertag = gamertag.trim();

    if (mode === "sign-up" && cleanGamertag.length < 2) {
      setError("El gamertag debe tener al menos 2 caracteres.");
      setIsLoading(false);
      return;
    }

    const result =
      mode === "sign-up"
        ? await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                gamertag: cleanGamertag
              },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
            }
          })
        : await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          });

    setIsLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setMessage("Cuenta creada. Revisa tu correo si Supabase solicita confirmacion.");
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.switcher} aria-label="Modo de autenticacion">
        <button
          aria-pressed={mode === "sign-in"}
          type="button"
          onClick={() => setMode("sign-in")}
        >
          Entrar
        </button>
        <button
          aria-pressed={mode === "sign-up"}
          type="button"
          onClick={() => setMode("sign-up")}
        >
          Crear cuenta
        </button>
      </div>

      {mode === "sign-up" ? (
        <label>
          Gamertag
          <input
            autoComplete="nickname"
            minLength={2}
            maxLength={32}
            onChange={(event) => setGamertag(event.target.value)}
            required
            type="text"
            value={gamertag}
          />
        </label>
      ) : null}

      <label>
        Email
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label>
        Password
        <input
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.message}>{message}</p> : null}

      <Button
        disabled={isLoading}
        icon={mode === "sign-up" ? UserPlus : LogIn}
        size="lg"
        type="submit"
      >
        {isLoading
          ? "Procesando"
          : mode === "sign-up"
            ? "Crear cuenta"
            : "Iniciar sesion"}
      </Button>
    </form>
  );
}
