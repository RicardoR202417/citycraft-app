"use client";

import { Save, Trash2, UserPlus } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../../components/ui";
import {
  addAdminPropertyOwner,
  deleteAdminProperty,
  removeAdminPropertyOwner,
  updateAdminProperty,
  updateAdminPropertyOwner
} from "./actions";
import styles from "./AdminPropertyForms.module.css";

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

const PROPERTY_STATUSES = [
  ["planned", "Planeada"],
  ["active", "Activa"],
  ["under_review", "En revision"],
  ["demolished", "Demolida"],
  ["archived", "Archivada"]
];

export function AdminPropertyForm({ districts, parentProperties, property }) {
  const [state, formAction, isPending] = useActionState(updateAdminProperty, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="property_id" type="hidden" value={property.id} />
      <div className={styles.fields}>
        <label>
          Nombre
          <input defaultValue={property.name} maxLength={120} name="name" required />
        </label>
        <label>
          Slug
          <input defaultValue={property.slug} maxLength={120} name="slug" required />
        </label>
      </div>

      <label>
        Direccion
        <input defaultValue={property.address} name="address" required />
      </label>

      <div className={styles.fields}>
        <label>
          Delegacion
          <select defaultValue={property.district_id} name="district_id" required>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Matriz
          <select defaultValue={property.parent_property_id || ""} name="parent_property_id">
            <option value="">Propiedad matriz</option>
            {parentProperties
              .filter((parentProperty) => parentProperty.id !== property.id)
              .map((parentProperty) => (
                <option key={parentProperty.id} value={parentProperty.id}>
                  {parentProperty.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className={styles.fields}>
        <label>
          Tipo
          <select defaultValue={property.type} name="type" required>
            {PROPERTY_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select defaultValue={property.status} name="status" required>
            {PROPERTY_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bloques
          <input
            defaultValue={Number(property.size_blocks || 0).toFixed(2)}
            min="0.01"
            name="size_blocks"
            required
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <label>
        Descripcion
        <textarea defaultValue={property.description || ""} maxLength={500} name="description" rows={3} />
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Save} size="sm" type="submit" variant="secondary">
          {isPending ? "Guardando" : "Guardar propiedad"}
        </Button>
      </div>
    </form>
  );
}

export function AddPropertyOwnerForm({ organizations, players, property }) {
  const [state, formAction, isPending] = useActionState(addAdminPropertyOwner, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="property_id" type="hidden" value={property.id} />
      <div className={styles.fields}>
        <label>
          Tipo
          <select defaultValue="profile" name="owner_type">
            <option value="profile">Jugador</option>
            <option value="organization">Organizacion</option>
          </select>
        </label>
        <label>
          Jugador
          <select name="profile_id">
            <option value="">No aplica</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.gamertag}
              </option>
            ))}
          </select>
        </label>
        <label>
          Organizacion
          <select name="organization_id">
            <option value="">No aplica</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Porcentaje
        <input defaultValue="100.00" max="100" min="0.01" name="ownership_percent" required step="0.01" type="number" />
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={UserPlus} size="sm" type="submit" variant="secondary">
          {isPending ? "Agregando" : "Agregar propietario"}
        </Button>
      </div>
    </form>
  );
}

export function UpdatePropertyOwnerForm({ owner }) {
  const [state, formAction, isPending] = useActionState(updateAdminPropertyOwner, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.inlineForm}>
      <input name="owner_id" type="hidden" value={owner.id} />
      <input name="property_id" type="hidden" value={owner.property_id} />
      <label>
        %
        <input
          defaultValue={Number(owner.ownership_percent || 0).toFixed(2)}
          max="100"
          min="0.01"
          name="ownership_percent"
          required
          step="0.01"
          type="number"
        />
      </label>
      <Button disabled={isPending} icon={Save} size="sm" type="submit" variant="secondary">
        {isPending ? "Guardando" : "Guardar"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function RemovePropertyOwnerForm({ owner }) {
  const [state, formAction, isPending] = useActionState(removeAdminPropertyOwner, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.removeForm}>
      <input name="owner_id" type="hidden" value={owner.id} />
      <input name="property_id" type="hidden" value={owner.property_id} />
      <Button disabled={isPending} icon={Trash2} size="sm" type="submit" variant="danger">
        {isPending ? "Removiendo" : "Remover"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function DeletePropertyForm({ property }) {
  const [state, formAction, isPending] = useActionState(deleteAdminProperty, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.dangerForm}>
      <input name="property_id" type="hidden" value={property.id} />
      <p>
        Esta accion elimina la propiedad y los registros dependientes que la base de datos permita borrar en cascada. No esta
        disponible para gobierno ni jugadores.
      </p>
      <label>
        Confirmacion
        <input
          autoComplete="off"
          name="confirmation"
          placeholder={`Escribe ${property.name}`}
          required
        />
      </label>
      <ActionFeedback state={state} />
      <div className={styles.actions}>
        <Button disabled={isPending} icon={Trash2} size="sm" type="submit" variant="danger">
          {isPending ? "Eliminando" : "Eliminar propiedad"}
        </Button>
      </div>
    </form>
  );
}
