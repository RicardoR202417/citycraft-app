"use client";

import { useEffect, useRef } from "react";
import { toast } from "./Toast";

const EMPTY_FEEDBACK_KEY = "|";

function createFeedbackKey(state) {
  return `${state?.error || ""}|${state?.message || ""}`;
}

export function ActionFeedback({
  errorTitle = "No se pudo completar",
  state,
  successTitle = "Operacion completada"
}) {
  const lastFeedbackKey = useRef(EMPTY_FEEDBACK_KEY);

  useEffect(() => {
    const feedbackKey = createFeedbackKey(state);

    if (feedbackKey === EMPTY_FEEDBACK_KEY || feedbackKey === lastFeedbackKey.current) {
      return;
    }

    lastFeedbackKey.current = feedbackKey;

    if (state?.error) {
      toast.error({
        description: state.error,
        title: errorTitle
      });
      return;
    }

    if (state?.message) {
      toast.success({
        description: state.message,
        title: successTitle
      });
    }
  }, [errorTitle, state, successTitle]);

  return null;
}
