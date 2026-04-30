"use client";

import { LogIn, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "../../components/ui";
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
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const nextPath = searchParams.get("next") || "/dashboard";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    const supabase = getSupabaseBrowserClient();

    const result =
      mode === "sign-up"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                gamertag
              },
              emailRedirectTo: `${window.location.origin}${nextPath}`
            }
          })
        : await supabase.auth.signInWithPassword({
            email,
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
