"use client";

import { ImagePlus, Send } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { getConstructionImageLimitLabel } from "../../../lib/storage/constructionImages";
import { createConstructionPost } from "../actions";
import styles from "./ConstructionPostForm.module.css";

export function ConstructionPostForm({ districtOptions, propertyOptions }) {
  const [state, formAction, isPending] = useActionState(createConstructionPost, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          Titulo
          <input maxLength={120} minLength={3} name="title" placeholder="Torre Mirador Central" required />
        </label>

        <label>
          Visibilidad
          <span className={styles.toggle}>
            <input defaultChecked name="is_public" type="checkbox" />
            <span>Publicar en el feed</span>
          </span>
        </label>
      </div>

      <label>
        Descripcion
        <textarea
          maxLength={4000}
          minLength={10}
          name="body"
          placeholder="Describe que se construyo, donde esta ubicado y que aporta a la ciudad."
          required
          rows={7}
        />
      </label>

      <div className={styles.grid}>
        <label>
          Delegacion
          <select name="district_id">
            <option value="">Sin delegacion asociada</option>
            {districtOptions.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Propiedad relacionada
          <select name="property_id">
            <option value="">Sin propiedad asociada</option>
            {propertyOptions.map((property) => (
              <option key={property.id} value={property.id}>
                {property.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.fileField}>
        <span>
          <ImagePlus size={18} />
          Imagen
        </span>
        <input accept="image/jpeg,image/png,image/webp,image/gif" name="cover_image" type="file" />
        <small>JPG, PNG, WebP o GIF. Maximo {getConstructionImageLimitLabel()}.</small>
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Send} type="submit">
          {isPending ? "Publicando" : "Guardar construccion"}
        </Button>
      </div>
    </form>
  );
}
