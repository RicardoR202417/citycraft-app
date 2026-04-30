"use client";

import { Building2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { createProperty } from "./actions";
import styles from "./PropertyForm.module.css";

const PROPERTY_TYPES = [
  ["land", "Terreno"],
  ["residential", "Habitacional"],
  ["commercial", "Local"],
  ["corporate", "Corporativo"],
  ["cultural", "Cultural"],
  ["entertainment", "Entretenimiento"],
  ["infrastructure", "Infraestructura"],
  ["service", "Servicio"],
  ["public", "Publica"]
];

export function PropertyForm({ districts, organizations, parentProperties, profiles }) {
  const [state, formAction, isPending] = useActionState(createProperty, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          Nombre
          <input maxLength={120} minLength={2} name="name" required type="text" />
        </label>

        <label>
          Slug
          <input
            autoComplete="off"
            maxLength={120}
            name="slug"
            placeholder="se-genera-si-lo-dejas-vacio"
            type="text"
          />
        </label>
      </div>

      <label>
        Direccion
        <input maxLength={180} name="address" required type="text" />
      </label>

      <label>
        Propiedad matriz
        <select name="parent_property_id">
          <option value="">Es una propiedad matriz</option>
          {parentProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name} - {property.districts?.name || "Sin delegacion"}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.grid}>
        <label>
          Delegacion
          <select disabled={!districts.length} name="district_id" required>
            <option value="">Seleccionar</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo
          <select name="type" required>
            {PROPERTY_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.grid}>
        <label>
          Tamano en bloques
          <input min="0.01" name="size_blocks" required step="0.01" type="number" />
        </label>

        <label>
          Valor inicial
          <input min="0" name="current_value" required step="0.01" type="number" />
        </label>
      </div>

      <div className={styles.grid}>
        <label>
          Propietario jugador
          <select name="owner_profile_id">
            <option value="">Sin jugador</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.gamertag}
              </option>
            ))}
          </select>
        </label>

        <label>
          Propietario organizacion
          <select name="owner_organization_id">
            <option value="">Sin organizacion</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Porcentaje inicial
        <input defaultValue="100" max="100" min="0.01" name="ownership_percent" required step="0.01" type="number" />
      </label>

      <label>
        Razon de valoracion
        <input defaultValue="Valor inicial" maxLength={240} name="valuation_reason" required type="text" />
      </label>

      <label>
        Descripcion
        <textarea maxLength={320} name="description" rows={4} />
      </label>

      <p className={styles.hint}>
        Para registrar una unidad privativa, selecciona su propiedad matriz y usa la misma delegacion.
        Selecciona un solo propietario inicial.
      </p>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending || !districts.length} icon={Building2} type="submit">
          {isPending ? "Guardando" : "Registrar propiedad"}
        </Button>
      </div>
    </form>
  );
}
