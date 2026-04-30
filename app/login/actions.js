"use server";

import { redirect } from "next/navigation";
import { normalizeRedirectPath } from "../../lib/auth/routes";
import { createSupabaseServerClient } from "../../lib/supabase/server";

const DEFAULT_AUTH_STATE = {
  error: "",
  message: ""
};

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyAuthError(error) {
  if (!error?.message) {
    return "No se pudo completar la autenticacion. Intenta nuevamente.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "El correo o password no coinciden.";
  }

  if (message.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesion.";
  }

  if (message.includes("user already registered")) {
    return "Ya existe una cuenta registrada con ese correo.";
  }

  if (message.includes("password")) {
    return "El password no cumple con los requisitos de seguridad.";
  }

  return "No se pudo completar la autenticacion. Revisa tus datos e intenta nuevamente.";
}

export async function authenticate(_previousState = DEFAULT_AUTH_STATE, formData) {
  const mode = getField(formData, "mode");
  const email = getField(formData, "email").toLowerCase();
  const password = getField(formData, "password");
  const gamertag = getField(formData, "gamertag");
  const nextPath = normalizeRedirectPath(getField(formData, "next"));

  if (!["sign-in", "sign-up"].includes(mode)) {
    return {
      error: "Selecciona una accion valida.",
      message: ""
    };
  }

  if (!email || !password) {
    return {
      error: "Correo y password son obligatorios.",
      message: ""
    };
  }

  if (mode === "sign-up" && gamertag.length < 2) {
    return {
      error: "El gamertag debe tener al menos 2 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();

  if (mode === "sign-in") {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return {
        error: friendlyAuthError(error),
        message: ""
      };
    }

    redirect(nextPath);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        gamertag
      },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`
    }
  });

  if (error) {
    return {
      error: friendlyAuthError(error),
      message: ""
    };
  }

  if (data.session) {
    redirect(nextPath);
  }

  return {
    error: "",
    message: "Cuenta creada. Revisa tu correo si Supabase solicita confirmacion."
  };
}
