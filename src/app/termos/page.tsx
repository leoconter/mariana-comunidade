import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 prose prose-neutral">
      <h1>Termos de Uso</h1>
      <p>
        <strong>
          [MINUTA — este texto é um rascunho e deve ser revisado por advogado
          especializado antes do lançamento.]
        </strong>
      </p>
      <p>
        A Comunidade é um serviço de assinatura de conteúdo educacional voltado
        a fisioterapeutas. Ao criar sua conta, você concorda com estes termos.
      </p>
      <h2>1. Acesso</h2>
      <p>
        O acesso é pessoal e intransferível, condicionado à assinatura ativa
        processada pela Kirvano. Compartilhar login ou conteúdo pago é vedado e
        pode levar ao encerramento da conta.
      </p>
      <h2>2. Conteúdo</h2>
      <p>
        Os materiais têm finalidade de educação continuada e não substituem o
        julgamento clínico individual de cada profissional.
      </p>
      <h2>3. Conduta e casos clínicos</h2>
      <p>
        É proibido publicar qualquer dado que identifique pacientes. Casos
        enviados para discussão devem ser integralmente anonimizados.
      </p>
      <h2>4. Cancelamento</h2>
      <p>
        O cancelamento é feito na Kirvano e o acesso permanece até o fim do
        período já pago.
      </p>
    </main>
  );
}
