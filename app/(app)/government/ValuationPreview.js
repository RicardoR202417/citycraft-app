"use client";

import { useMemo } from "react";
import { Badge, DataList } from "../../../components/ui";
import { formatMoney } from "../../../lib/economy";
import { calculateSuggestedPropertyValue } from "../../../lib/propertyValuation";
import styles from "./ValuationPreview.module.css";

export function ValuationPreview({
  buildingAreaBlocks,
  districtAppreciationRate,
  landAreaBlocks,
  title = "Valor sugerido",
  type
}) {
  const suggestion = useMemo(
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
    <aside className={styles.preview} aria-label={title}>
      <div className={styles.header}>
        <span>{title}</span>
        <strong>{formatMoney(suggestion.suggestedValue)}</strong>
        <Badge tone="info">{suggestion.propertyTypeLabel}</Badge>
      </div>
      <DataList
        items={[
          { label: "Terreno", value: formatMoney(suggestion.landValue) },
          { label: "Construccion", value: formatMoney(suggestion.constructionValue) },
          { label: "Plusvalia", value: `${suggestion.appreciationRate.toFixed(2)}%` },
          { label: "Ajuste zona", value: formatMoney(suggestion.zoneAdjustment) }
        ]}
      />
    </aside>
  );
}
