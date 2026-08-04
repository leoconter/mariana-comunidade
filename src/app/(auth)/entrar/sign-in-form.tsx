"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithMagicLink,
  signInWithPassword,
  type SignInState,
} from "./actions";

const initialState: SignInState = { status: "idle" };

export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction, linkPending] = useActionState(
    signInWithMagicLink,
    initialState
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialState
  );

  if (linkState.status === "sent") {
    return (
      <Alert>
        <MailCheck className="size-4" />
        <AlertTitle>Link enviado!</AlertTitle>
        <AlertDescription>
          Confira sua caixa de entrada (e o spam). O link de acesso expira em 1
          hora. Você pode fechar esta aba.
        </AlertDescription>
      </Alert>
    );
  }

  const state = mode === "link" ? linkState : passwordState;
  const pending = mode === "link" ? linkPending : passwordPending;

  return (
    <form
      action={mode === "link" ? linkAction : passwordAction}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
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

      {mode === "password" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      )}

      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? mode === "link"
            ? "Enviando..."
            : "Entrando..."
          : mode === "link"
            ? "Receber link de acesso"
            : "Entrar"}
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "link" ? "password" : "link")}
        className="text-center text-sm text-muted-foreground underline underline-offset-4"
      >
        {mode === "link" ? "Entrar com senha" : "Entrar com link por e-mail"}
      </button>
    </form>
  );
}
