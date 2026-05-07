"use client";

import { ClipboardCheck } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { createPropertyPermitRequest } from "./actions";
import styles from "./PermitRequestForm.module.css";

const PROPERTY_TYPES = [
  ["", "Sin cambio"],
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

const REQUEST_TYPES = [
  ["construction", "Construccion"],
  ["modification", "Modificacion"],
  ["demolition", "Demolicion"]
];

export function PermitRequestForm({ properties }) {
  const [state, formAction, isPending] = useActionState(createPropertyPermitRequest, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          Propiedad
          <select disabled={!properties.length} name="property_id" required>
            <option value="">Seleccionar</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo de solicitud
          <select defaultValue="construction" name="request_type" required>
            {REQUEST_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Titulo
        <input maxLength={120} minLength={3} name="title" required type="text" />
      </label>

      <label>
        Descripcion
        <textarea
          maxLength={1000}
          minLength={10}
          name="description"
          placeholder="Describe que quieres construir, modificar o demoler y por que."
          required
          rows={4}
        />
      </label>

      <div className={styles.grid}>
        <label>
          Tipo propuesto
          <select name="proposed_type">
            {PROPERTY_TYPES.map(([value, label]) => (
              <option key={value || "none"} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Bloques propuestos
          <input min="0.01" name="proposed_size_blocks" step="0.01" type="number" />
        </label>

        <label>
          Valor propuesto
          <input min="0" name="proposed_value" step="0.01" type="number" />
        </label>
      </div>

      <p className={styles.hint}>
        El gobierno revisara la solicitud. Si la aprueba, puede aplicar el cambio de tipo,
        tamano, valor o estado de la propiedad.
      </p>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending || !properties.length} icon={ClipboardCheck} type="submit">
          {isPending ? "Enviando" : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}
