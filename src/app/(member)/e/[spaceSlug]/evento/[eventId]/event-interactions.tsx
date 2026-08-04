"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rsvpEvent, submitCase } from "@/app/(member)/actions";

export function RsvpToggle({
  eventId,
  initialGoing,
}: {
  eventId: string;
  initialGoing: boolean;
}) {
  const [going, setGoing] = useState(initialGoing);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant={going ? "secondary" : "default"}
      size="sm"
      disabled={pending}
      onClick={() => {
        const next = !going;
        setGoing(next);
        startTransition(async () => {
          try {
            await rsvpEvent(eventId, next);
            toast.success(
              next
                ? "Presença confirmada! Você recebe lembrete antes da call."
                : "Presença cancelada."
            );
            router.refresh();
          } catch {
            setGoing(!next);
          }
        });
      }}
    >
      <CheckCircle2 className="size-4" />
      {going ? "Presença confirmada" : "Confirmar presença"}
    </Button>
  );
}

export function CaseSubmissionForm({
  eventId,
  alreadySubmitted,
}: {
  eventId: string;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [history, setHistory] = useState("");
  const [assessment, setAssessment] = useState("");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  if (submitted) {
    return (
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertTitle>Caso enviado!</AlertTitle>
        <AlertDescription>
          Seu caso está na fila para discussão no Round. Se quiser enviar outro,
          fale com a Mariana.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-lg">Traga seu caso impossível</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie antes da call — a Mariana seleciona e discute ao vivo seguindo
          hipóteses → avaliação → diagnóstico funcional → conduta.
        </p>
      </div>

      <Alert variant="destructive">
        <ShieldAlert className="size-4" />
        <AlertTitle>Proteja a identidade da sua paciente</AlertTitle>
        <AlertDescription>
          É proibido incluir nome, iniciais identificáveis, foto, número de
          prontuário, cidade pequena com detalhes ou qualquer informação que
          permita identificar a paciente. Descreva apenas o quadro clínico.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-2">
        <Label htmlFor="case-complaint">Queixa principal *</Label>
        <Textarea
          id="case-complaint"
          rows={2}
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="Ex.: dor na relação há 2 anos, piora progressiva..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="case-history">História relevante</Label>
        <Textarea
          id="case-history"
          rows={3}
          value={history}
          onChange={(e) => setHistory(e.target.value)}
          placeholder="Idade aproximada, tempo de evolução, tratamentos prévios, comorbidades..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="case-assessment">O que você já avaliou/tentou</Label>
        <Textarea
          id="case-assessment"
          rows={3}
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
          placeholder="Achados do exame físico, condutas já testadas e resposta..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="case-question">Sua dúvida para a discussão *</Label>
        <Textarea
          id="case-question"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="O que está te travando neste caso?"
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          className="mt-0.5"
        />
        <span>
          Confirmo que este caso <strong>não contém</strong> nome, imagem,
          prontuário ou qualquer dado que identifique a paciente, e estou ciente
          de que a discussão pode ser gravada e disponibilizada às membras da
          comunidade.
        </span>
      </label>

      <Button
        disabled={pending || !consent}
        onClick={() =>
          startTransition(async () => {
            const result = await submitCase({
              eventId,
              chiefComplaint,
              history,
              assessment,
              question,
              consentAccepted: consent,
            });
            if (result.ok) {
              setSubmitted(true);
              toast.success("Caso enviado para o Round!");
              router.refresh();
            } else {
              toast.error(result.message);
            }
          })
        }
      >
        {pending ? "Enviando..." : "Enviar caso"}
      </Button>
    </div>
  );
}
