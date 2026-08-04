import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 prose prose-neutral">
      <h1>Política de Privacidade</h1>
      <p>
        <strong>
          [MINUTA — este texto é um rascunho e deve ser revisado por advogado
          especializado em LGPD na área da saúde antes do lançamento.]
        </strong>
      </p>
      <h2>Dados que tratamos</h2>
      <p>
        Nome, e-mail, dados profissionais informados no perfil (cidade, CREFITO,
        bio), registros de uso (conteúdos vistos, progresso de vídeos,
        comentários) e status da assinatura recebido da Kirvano.
      </p>
      <h2>Casos clínicos</h2>
      <p>
        Os casos enviados para discussão não devem conter dados que identifiquem
        pacientes. O envio exige confirmação expressa de anonimização, registrada
        com data, IP e versão do termo. [Definir período de retenção e
        auto-exclusão com o advogado.]
      </p>
      <h2>Operadores</h2>
      <p>
        Utilizamos Supabase (banco de dados e autenticação), Vercel
        (hospedagem), Bunny.net (vídeo) e Resend (e-mail transacional), com
        possível transferência internacional de dados. [Detalhar salvaguardas
        com o advogado.]
      </p>
      <h2>Seus direitos</h2>
      <p>
        Você pode exportar seus dados e excluir sua conta a qualquer momento em
        “Meu perfil”, além de solicitar informações pelo nosso canal de contato:
        [definir e-mail do encarregado/DPO].
      </p>
    </main>
  );
}
