"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setNewPassword, type NewPasswordState } from "./actions";

const initialState: NewPasswordState = { status: "idle" };

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(
    setNewPassword,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password_confirmation">Repita a senha</Label>
        <Input
          id="password_confirmation"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando..." : "Salvar senha e entrar"}
      </Button>
    </form>
  );
}
