import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acesso indisponível" };

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl">Sua assinatura não está ativa</h1>
      <p className="text-sm text-muted-foreground">
        Você entrou com sucesso, mas não encontramos uma assinatura ativa para
        este e-mail. Se você acabou de assinar, aguarde alguns minutos e
        recarregue a página.
      </p>
      <p className="text-sm text-muted-foreground">
        Assinou com outro e-mail ou acha que isso é um engano? Fale com a gente
        que resolvemos rapidinho.
      </p>
      <Button asChild className="w-full">
        <a href="mailto:contato@marianavalentina.com.br">Falar com o suporte</a>
      </Button>
    </div>
  );
}
