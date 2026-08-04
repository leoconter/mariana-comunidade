"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldDescriptor } from "@/lib/post-fields";

export function CustomFieldsForm({
  fields,
  values,
  onChange,
}: {
  fields: FieldDescriptor[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const visible = fields.filter(
    (f) => f.type === "select" || f.type === "text"
  );
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
      {visible.map((field) => (
        <div key={field.key} className="flex flex-col gap-2">
          <Label>
            {field.label ?? field.key}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          {field.type === "select" ? (
            <Select
              value={values[field.key] ?? ""}
              onValueChange={(value) =>
                onChange({ ...values, [field.key]: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={values[field.key] ?? ""}
              onChange={(e) =>
                onChange({ ...values, [field.key]: e.target.value })
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
