"use server";

import { requireAdmin } from "@/lib/auth";
import {
  normalizeKirvanoEvent,
  processKirvanoEvent,
  type KirvanoEventKind,
} from "@/lib/kirvano";

export type SimulatorResult = { ok: boolean; message: string };

const SIMULATED_EVENTS: Record<KirvanoEventKind, string> = {
  activated: "SALE_APPROVED",
  renewed: "SUBSCRIPTION_RENEWED",
  payment_failed: "SUBSCRIPTION_LATE",
  canceled: "SUBSCRIPTION_CANCELED",
  reactivated: "SUBSCRIPTION_REACTIVATED",
};

function simulatorEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_WEBHOOK_SIMULATOR === "true"
  );
}

/** Runs the exact same pipeline as the real webhook, with a synthetic payload. */
export async function simulateKirvanoEvent(
  email: string,
  kind: KirvanoEventKind,
  plan: "monthly" | "quarterly" | "annual"
): Promise<SimulatorResult> {
  await requireAdmin();
  if (!simulatorEnabled()) {
    return { ok: false, message: "Simulador desabilitado em produção." };
  }

  const normalized = normalizeKirvanoEvent({
    event: SIMULATED_EVENTS[kind],
    event_id: `sim_${kind}_${Date.now()}`,
    customer: { email: email.trim().toLowerCase(), name: "Membra de Teste" },
    plan: {
      name:
        plan === "annual"
          ? "Plano Anual"
          : plan === "quarterly"
            ? "Plano Trimestral"
            : "Plano Mensal",
    },
  });
  if (!normalized) return { ok: false, message: "Payload simulado inválido." };

  const result = await processKirvanoEvent(normalized);
  return result.ok
    ? { ok: true, message: `Evento “${SIMULATED_EVENTS[kind]}” processado para ${email}.` }
    : { ok: false, message: "Falha ao processar o evento simulado." };
}
