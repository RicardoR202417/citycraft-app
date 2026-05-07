"use client";

import { Building2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { calculateSuggestedPropertyValue } from "../../../lib/propertyValuation";
import { createProperty } from "./actions";
import styles from "./PropertyForm.module.css";
import { ValuationPreview } from "./ValuationPreview";

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
  const [districtId, setDistrictId] = useState("");
  const [type, setType] = useState("land");
  const [landAreaBlocks, setLandAreaBlocks] = useState("");
  const [buildingAreaBlocks, setBuildingAreaBlocks] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const selectedDistrict = districts.find((district) => district.id === districtId);
  const districtAppreciationRate = Number(
    selectedDistrict?.current_appreciation_rate ?? selectedDistrict?.base_appreciation_rate ?? 0
  );
  const suggested = useMemo(
    () =>
      calculateSuggestedPropertyValue({
        buildingAreaBlocks,
        districtAppreciationRate,
        landAreaBlocks,
        type
      }),
    [buildingAreaBlocks, districtAppreciationRate, landAreaBlocks, type]
  );

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
          <select
            disabled={!districts.length}
            name="district_id"
            onChange={(event) => setDistrictId(event.target.value)}
            required
            value={districtId}
          >
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
          <select name="type" onChange={(event) => setType(event.target.value)} required value={type}>
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
          Area de terreno
          <input
            min="0.01"
            name="land_area_blocks"
            onChange={(event) => setLandAreaBlocks(event.target.value)}
            required
            step="0.01"
            type="number"
            value={landAreaBlocks}
          />
        </label>

        <label>
          Construccion inicial
          <input
            min="0"
            name="building_area_blocks"
            onChange={(event) => setBuildingAreaBlocks(event.target.value)}
            step="0.01"
            type="number"
            value={buildingAreaBlocks}
          />
        </label>
      </div>

      <div className={styles.grid}>
        <label>
          Valor inicial
          <input
            min="0"
            name="current_value"
            onChange={(event) => setCurrentValue(event.target.value)}
            required
            step="0.01"
            type="number"
            value={currentValue}
          />
        </label>

        <div className={styles.suggestionAction}>
          <span>Vista previa</span>
          <button type="button" onClick={() => setCurrentValue(String(suggested.suggestedValue))}>
            Usar valor sugerido
          </button>
        </div>
      </div>

      <ValuationPreview
        buildingAreaBlocks={buildingAreaBlocks}
        districtAppreciationRate={districtAppreciationRate}
        landAreaBlocks={landAreaBlocks}
        type={type}
      />

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
        <input defaultValue="Valor sugerido aceptado" maxLength={240} name="valuation_reason" required type="text" />
      </label>

      <label>
        Descripcion
        <textarea maxLength={320} name="description" rows={4} />
      </label>

      <p className={styles.hint}>
        Para registrar una unidad privativa, selecciona su propiedad matriz y usa la misma delegacion.
        Selecciona un solo propietario inicial.
      </p>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending || !districts.length} icon={Building2} type="submit">
          {isPending ? "Guardando" : "Registrar propiedad"}
        </Button>
      </div>
    </form>
  );
}
