"use client";

import { TrendingUp } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { calculateSuggestedPropertyValue } from "../../../lib/propertyValuation";
import { recordPropertyValuation } from "./actions";
import styles from "./ValuationForm.module.css";
import { ValuationPreview } from "./ValuationPreview";

export function ValuationForm({ properties }) {
  const [state, formAction, isPending] = useActionState(recordPropertyValuation, {
    error: "",
    message: ""
  });
  const [propertyId, setPropertyId] = useState("");
  const [value, setValue] = useState("");
  const selectedProperty = properties.find((property) => property.id === propertyId);
  const districtAppreciationRate = Number(
    selectedProperty?.districts?.current_appreciation_rate ??
      selectedProperty?.districts?.base_appreciation_rate ??
      0
  );
  const suggested = useMemo(
    () =>
      calculateSuggestedPropertyValue({
        buildingAreaBlocks: selectedProperty?.building_area_blocks || 0,
        districtAppreciationRate,
        landAreaBlocks: selectedProperty?.land_area_blocks || selectedProperty?.size_blocks || 0,
        type: selectedProperty?.type || "land"
      }),
    [districtAppreciationRate, selectedProperty]
  );

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Propiedad
        <select
          disabled={!properties.length}
          name="property_id"
          onChange={(event) => setPropertyId(event.target.value)}
          required
          value={propertyId}
        >
          <option value="">Seleccionar</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.grid}>
        <label>
          Nuevo valor
          <input
            min="0"
            name="value"
            onChange={(event) => setValue(event.target.value)}
            required
            step="0.01"
            type="number"
            value={value}
          />
        </label>

        <label>
          Razon
          <input maxLength={240} minLength={3} name="reason" required type="text" />
        </label>
      </div>

      <ValuationPreview
        buildingAreaBlocks={selectedProperty?.building_area_blocks || 0}
        districtAppreciationRate={districtAppreciationRate}
        landAreaBlocks={selectedProperty?.land_area_blocks || selectedProperty?.size_blocks || 0}
        title="Valor recalculado"
        type={selectedProperty?.type || "land"}
      />

      <button
        className={styles.suggestionButton}
        disabled={!selectedProperty}
        type="button"
        onClick={() => setValue(String(suggested.suggestedValue))}
      >
        Usar valor recalculado
      </button>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending || !properties.length} icon={TrendingUp} type="submit">
          {isPending ? "Guardando" : "Registrar valoracion"}
        </Button>
      </div>
    </form>
  );
}
