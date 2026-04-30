"use client";

import { LogIn, UserPlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { Button } from "../../components/ui";
import { normalizeRedirectPath } from "../../lib/auth/routes";
import { authenticate } from "./actions";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState("sign-in");
  const nextPath = normalizeRedirectPath(searchParams.get("next"));
  const initialError =
    searchParams.get("error") === "auth_callback"
      ? "No se pudo completar la autenticacion. Intenta iniciar sesion nuevamente."
      : "";
  const [state, formAction, isPending] = useActionState(authenticate, {
    error: initialError,
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="mode" type="hidden" value={mode} />
      <input name="next" type="hidden" value={nextPath} />

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
            name="gamertag"
            required
            type="text"
          />
        </label>
      ) : null}

      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          required
          type="email"
        />
      </label>

      <label>
        Password
        <input
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <Button
        disabled={isPending}
        icon={mode === "sign-up" ? UserPlus : LogIn}
        size="lg"
        type="submit"
      >
        {isPending
          ? "Procesando"
          : mode === "sign-up"
            ? "Crear cuenta"
            : "Iniciar sesion"}
      </Button>
    </form>
  );
}
