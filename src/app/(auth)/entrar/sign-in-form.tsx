"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithMagicLink, type SignInState } from "./actions";

const initialState: SignInState = { status: "idle" };

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(
    signInWithMagicLink,
    initialState
  );

  if (state.status === "sent") {
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

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Receber link de acesso"}
      </Button>
    </form>
  );
}
