"use client";

import { LandPlot, Save } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { createUnownedLand, updateUnownedLandDisposition } from "./actions";
import styles from "./UnownedLandForms.module.css";

const LAND_DISPOSITIONS = [
  ["available", "Disponible"],
  ["reserved", "Reservada"],
  ["for_sale", "En venta"],
  ["for_auction", "En subasta"]
];

const PROPERTY_STATUSES = [
  ["planned", "Planeada"],
  ["active", "Activa"],
  ["under_review", "En revision"],
  ["demolished", "Demolida"],
  ["archived", "Archivada"]
];

export function UnownedLandForm({ districts }) {
  const [state, formAction, isPending] = useActionState(createUnownedLand, {
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
          Disponibilidad
          <select defaultValue="available" name="government_disposition" required>
            {LAND_DISPOSITIONS.map(([value, label]) => (
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

      <label>
        Razon de valoracion
        <input defaultValue="Valor inicial de tierra sin dueño" maxLength={240} name="valuation_reason" required type="text" />
      </label>

      <label>
        Descripcion
        <textarea maxLength={320} name="description" rows={4} />
      </label>

      <p className={styles.hint}>
        Este flujo registra tierra tipo terreno sin propietarios. El gobierno la puede reservar,
        publicar como disponible, venta o subasta para flujos posteriores del mercado.
      </p>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending || !districts.length} icon={LandPlot} type="submit">
          {isPending ? "Guardando" : "Registrar tierra"}
        </Button>
      </div>
    </form>
  );
}

export function UnownedLandDispositionForm({ land }) {
  const [state, formAction, isPending] = useActionState(updateUnownedLandDisposition, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.inlineForm}>
      <input name="property_id" type="hidden" value={land.id} />

      <label>
        Disponibilidad
        <select defaultValue={land.government_disposition || "available"} name="government_disposition">
          {LAND_DISPOSITIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Estado
        <select defaultValue={land.status || "active"} name="status">
          {PROPERTY_STATUSES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <Button disabled={isPending} icon={Save} size="sm" type="submit" variant="secondary">
        {isPending ? "Guardando" : "Guardar"}
      </Button>

      {state.error ? <p className={styles.inlineError}>{state.error}</p> : null}
      {state.message ? <p className={styles.inlineMessage}>{state.message}</p> : null}
    </form>
  );
}
