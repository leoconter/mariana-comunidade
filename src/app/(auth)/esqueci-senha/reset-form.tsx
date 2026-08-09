"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type ResetState } from "./actions";

const initialState: ResetState = { status: "idle" };

export function ResetForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  if (state.status === "sent") {
    return (
      <Alert>
        <MailCheck className="size-4" />
        <AlertTitle>Link enviado!</AlertTitle>
        <AlertDescription>
          Se existir uma conta com esse e-mail, o link para criar a nova senha
          já está a caminho. Confira também a caixa de spam — o link vale por 1
          hora.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="voce@exemplo.com.br"
          required
          autoFocus
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
