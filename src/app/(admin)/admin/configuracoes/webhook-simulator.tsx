"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { simulateKirvanoEvent } from "./actions";
import type { KirvanoEventKind } from "@/lib/kirvano";

const EVENTS: { kind: KirvanoEventKind; label: string }[] = [
  { kind: "activated", label: "Assinatura ativada" },
  { kind: "renewed", label: "Renovação paga" },
  { kind: "payment_failed", label: "Pagamento falhou (inicia carência)" },
  { kind: "canceled", label: "Cancelamento" },
  { kind: "reactivated", label: "Reativação" },
];

export function WebhookSimulator() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"monthly" | "quarterly" | "annual">(
    "monthly"
  );
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sim-email">E-mail da assinante</Label>
          <Input
            id="sim-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teste@exemplo.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Plano</Label>
          <Select
            value={plan}
            onValueChange={(v) => setPlan(v as typeof plan)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="annual">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {EVENTS.map((event) => (
          <Button
            key={event.kind}
            variant="outline"
            size="sm"
            disabled={pending || !email.includes("@")}
            onClick={() =>
              startTransition(async () => {
                const result = await simulateKirvanoEvent(
                  email,
                  event.kind,
                  plan
                );
                if (result.ok) toast.success(result.message);
                else toast.error(result.message);
              })
            }
          >
            {event.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
