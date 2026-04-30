"use client";

import { Bell, CheckCircle2, Gavel, LandPlot } from "lucide-react";
import { sileo } from "sileo";
import styles from "./ToastDemo.module.css";

export function ToastDemo() {
  function showToast(type) {
    const common = {
      duration: 5200,
      roundness: 8
    };

    if (type === "bid") {
      sileo.info({
        ...common,
        icon: <Gavel size={16} />,
        title: "Nueva puja registrada",
        description: "Distrito Central supera la oferta actual por CC$12,500."
      });
      return;
    }

    if (type === "property") {
      sileo.success({
        ...common,
        icon: <LandPlot size={16} />,
        title: "Propiedad transferida",
        description: "Torre Prado ahora pertenece a Horizonte Urbano."
      });
      return;
    }

    sileo.action({
      ...common,
      icon: <CheckCircle2 size={16} />,
      title: "Asistencia validada",
      description: "Se proceso el pago diario del jugador y sus organizaciones.",
      button: {
        title: "Ver ledger",
        onClick: () => {}
      }
    });
  }

  return (
    <div className={styles.actions} aria-label="Demostracion de notificaciones">
      <button type="button" onClick={() => showToast("attendance")}>
        <Bell size={16} />
        Asistencia
      </button>
      <button type="button" onClick={() => showToast("bid")}>
        <Gavel size={16} />
        Puja
      </button>
      <button type="button" onClick={() => showToast("property")}>
        <LandPlot size={16} />
        Propiedad
      </button>
    </div>
  );
}
