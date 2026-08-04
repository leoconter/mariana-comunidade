import type { Json } from "@/lib/database.types";

export type FieldOption = { value: string; label: string; color?: string };

export type FieldDescriptor = {
  key: string;
  label?: string;
  type: "select" | "text" | "tags" | "attachment_slots";
  required?: boolean;
  options?: FieldOption[];
  slots?: string[];
};

/** Parse post_types.field_schema (stored as JSONB) defensively. */
export function parseFieldSchema(raw: Json | null | undefined): FieldDescriptor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is FieldDescriptor & Record<string, Json> =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).key === "string" &&
      typeof (item as Record<string, unknown>).type === "string"
  );
}

export const CLINICAL_IMPACT: Record<
  string,
  { label: string; emoji: string; className: string }
> = {
  alto: {
    label: "Alto impacto — muda a conduta imediatamente",
    emoji: "🟢",
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  medio: {
    label: "Médio impacto — muda o raciocínio clínico",
    emoji: "🟡",
    className:
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  baixo: {
    label: "Baixo impacto — atualização científica",
    emoji: "🔵",
    className: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  },
};
