"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { formatDate } from "@/lib/format";
import {
  banMember,
  muteMember,
  unbanMember,
  unmuteMember,
} from "../../moderacao/actions";
import {
  grantAccess,
  resendMagicLink,
  revokeGrant,
  setMemberRole,
  updateMemberName,
  type MemberActionResult,
} from "../actions";

type Grant = {
  id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
};

export function MemberDetailActions({
  userId,
  email,
  fullName,
  role,
  grants,
  muted,
  banned,
}: {
  userId: string;
  email: string;
  fullName: string;
  role: "member" | "moderator" | "admin";
  grants: Grant[];
  muted: boolean;
  banned: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(fullName);
  const [grantExpiry, setGrantExpiry] = useState("");
  const [grantReason, setGrantReason] = useState("");

  function run(
    action: () => Promise<MemberActionResult | void>,
    successMessage?: string
  ) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result && !result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(
          (result && result.message) || successMessage || "Feito!"
        );
        router.refresh();
      } catch {
        toast.error("Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Editar</h2>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
          />
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => updateMemberName(userId, name), "Nome salvo.")}
          >
            Salvar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label className="shrink-0">Papel</Label>
          <Select
            value={role}
            onValueChange={(value) =>
              run(
                () =>
                  setMemberRole(
                    userId,
                    value as "member" | "moderator" | "admin"
                  ),
                "Papel atualizado."
              )
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Membra</SelectItem>
              <SelectItem value="moderator">Moderadora</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => resendMagicLink(email))}
          >
            Reenviar link de acesso
          </Button>
          {muted ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => unmuteMember(userId), "Silêncio removido.")}
            >
              Remover silêncio
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => muteMember(userId, 7), "Silenciada por 7 dias.")
              }
            >
              Silenciar (7 dias)
            </Button>
          )}
          {banned ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => unbanMember(userId), "Banimento removido.")}
            >
              Remover banimento
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => run(() => banMember(userId), "Membra banida.")}
            >
              Banir
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Acesso cortesia</h2>
        {grants.length > 0 && (
          <ul className="flex flex-col gap-2">
            {grants.map((grant) => (
              <li
                key={grant.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {grant.expires_at
                    ? `Até ${formatDate(grant.expires_at)}`
                    : "Sem prazo"}
                  {grant.reason && ` — ${grant.reason}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => revokeGrant(grant.id, userId), "Acesso revogado.")
                  }
                >
                  Revogar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            type="date"
            value={grantExpiry}
            onChange={(e) => setGrantExpiry(e.target.value)}
            aria-label="Validade (opcional)"
          />
          <Input
            value={grantReason}
            onChange={(e) => setGrantReason(e.target.value)}
            placeholder="Motivo (ex.: parceria)"
          />
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  grantAccess(
                    userId,
                    grantExpiry
                      ? new Date(`${grantExpiry}T23:59:59-03:00`).toISOString()
                      : null,
                    grantReason
                  ),
                "Acesso concedido."
              )
            }
          >
            Conceder
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cortesia dá acesso independente da assinatura Kirvano. Sem data =
          acesso por tempo indeterminado.
        </p>
      </section>
    </div>
  );
}
