"use client";

import { CalendarCheck } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { recordAttendance } from "./actions";
import styles from "./AttendanceForm.module.css";

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceForm({ profiles }) {
  const [state, formAction, isPending] = useActionState(recordAttendance, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          Jugador
          <select disabled={!profiles.length} name="profile_id" required>
            <option value="">Seleccionar</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.gamertag}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fecha real
          <input defaultValue={getTodayValue()} name="attendance_date" required type="date" />
        </label>
      </div>

      <label>
        Minutos jugados
        <input defaultValue="30" max="1440" min="30" name="minutes_played" required step="1" type="number" />
      </label>

      <label>
        Notas
        <textarea maxLength={320} name="notes" placeholder="Referencia opcional de la linea de tiempo del Realm" rows={4} />
      </label>

      <p className={styles.hint}>
        Una asistencia valida requiere al menos 30 minutos conectados. Al guardar, el sistema registra la asistencia y
        genera el pago diario directo del jugador en una sola transaccion.
      </p>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending || !profiles.length} icon={CalendarCheck} type="submit">
          {isPending ? "Registrando" : "Registrar asistencia"}
        </Button>
      </div>
    </form>
  );
}
