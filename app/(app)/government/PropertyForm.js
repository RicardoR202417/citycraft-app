"use client";

import { Building2, Plus, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { calculateSuggestedPropertyValue } from "../../../lib/propertyValuation";
import { createProperty } from "./actions";
import styles from "./PropertyForm.module.css";
import { ValuationPreview } from "./ValuationPreview";

function createBlankOwner() {
  return {
    id: crypto.randomUUID(),
    organizationId: "",
    percent: "",
    profileId: "",
    type: "profile"
  };
}

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
  const [owners, setOwners] = useState([{ ...createBlankOwner(), percent: "100" }]);
  const selectedDistrict = districts.find((district) => district.id === districtId);
  const districtAppreciationRate = Number(
    selectedDistrict?.current_appreciation_rate ?? selectedDistrict?.base_appreciation_rate ?? 0
  );
  const ownershipTotal = owners.reduce((sum, owner) => sum + Number(owner.percent || 0), 0);
  const sortedPercents = owners.map((owner) => Number(owner.percent || 0)).sort((a, b) => b - a);
  const majorityGap = (sortedPercents[0] || 0) - (sortedPercents[1] || 0);
  const ownershipIsValid = Math.round(ownershipTotal * 100) / 100 === 100 && majorityGap >= 1;

  function updateOwner(ownerId, key, value) {
    setOwners((currentOwners) =>
      currentOwners.map((owner) =>
        owner.id === ownerId
          ? {
              ...owner,
              [key]: value,
              ...(key === "type" ? { organizationId: "", profileId: "" } : {})
            }
          : owner
      )
    );
  }

  function addOwner() {
    setOwners((currentOwners) => [...currentOwners, createBlankOwner()]);
  }

  function removeOwner(ownerId) {
    setOwners((currentOwners) =>
      currentOwners.length > 1 ? currentOwners.filter((owner) => owner.id !== ownerId) : currentOwners
    );
  }
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

      <section className={styles.ownersSection} aria-label="Propietarios iniciales">
        <div className={styles.ownersHeader}>
          <div>
            <strong>Propietarios iniciales</strong>
            <span>La suma debe ser 100% y debe existir un propietario mayoritario.</span>
          </div>
          <button type="button" onClick={addOwner}>
            <Plus size={16} />
            Agregar
          </button>
        </div>

        <div className={styles.ownerRows}>
          {owners.map((owner, index) => (
            <div className={styles.ownerRow} key={owner.id}>
              <input name="owner_type" type="hidden" value={owner.type} />
              <input name="owner_profile_id" type="hidden" value={owner.profileId} />
              <input name="owner_organization_id" type="hidden" value={owner.organizationId} />

              <label>
                Tipo
                <select value={owner.type} onChange={(event) => updateOwner(owner.id, "type", event.target.value)}>
                  <option value="profile">Jugador</option>
                  <option value="organization">Organizacion</option>
                </select>
              </label>

              {owner.type === "profile" ? (
                <label>
                  Jugador
                  <select
                    required
                    value={owner.profileId}
                    onChange={(event) => updateOwner(owner.id, "profileId", event.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.gamertag}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Organizacion
                  <select
                    required
                    value={owner.organizationId}
                    onChange={(event) => updateOwner(owner.id, "organizationId", event.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Porcentaje
                <input
                  max="100"
                  min="0.01"
                  name="ownership_percent"
                  onChange={(event) => updateOwner(owner.id, "percent", event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={owner.percent}
                />
              </label>

              <button
                aria-label={`Quitar propietario ${index + 1}`}
                className={styles.removeOwner}
                disabled={owners.length === 1}
                type="button"
                onClick={() => removeOwner(owner.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.ownershipSummary} data-valid={ownershipIsValid}>
          <span>Total: {ownershipTotal.toFixed(2)}%</span>
          <span>Ventaja mayoritaria: {majorityGap.toFixed(2)} pts</span>
        </div>
      </section>

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
        La propiedad se guarda de forma atomica con todos sus propietarios y valoracion inicial.
      </p>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending || !districts.length || !ownershipIsValid} icon={Building2} type="submit">
          {isPending ? "Guardando" : "Registrar propiedad"}
        </Button>
      </div>
    </form>
  );
}
