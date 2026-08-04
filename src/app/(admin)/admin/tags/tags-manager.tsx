"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Merge, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTag, deleteTag, mergeTags, renameTag } from "./actions";

type TagRow = { id: string; name: string; slug: string; usage: number };

export function TagsManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<TagRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mergeSource, setMergeSource] = useState<TagRow | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await createTag(newName);
            if (result.ok) {
              toast.success("Tag criada.");
              setNewName("");
              router.refresh();
            } else toast.error(result.message);
          });
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova tag (ex.: Vulvodínia)"
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          <Plus className="size-4" /> Criar
        </Button>
      </form>

      <ul className="divide-y rounded-xl border bg-card">
        {tags.map((tag) => (
          <li key={tag.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{tag.name}</p>
              <p className="text-xs text-muted-foreground">
                {tag.usage === 0
                  ? "Sem posts"
                  : tag.usage === 1
                    ? "1 post"
                    : `${tag.usage} posts`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={pending}>
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setRenameTarget(tag);
                    setRenameValue(tag.name);
                  }}
                >
                  <Pencil className="size-4" /> Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setMergeSource(tag);
                    setMergeTargetId("");
                  }}
                >
                  <Merge className="size-4" /> Mesclar em outra
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteTag(tag.id);
                      if (result.ok) {
                        toast.success("Tag excluída.");
                        router.refresh();
                      } else toast.error(result.message);
                    })
                  }
                >
                  <Trash2 className="size-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear tag</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!renameTarget) return;
              startTransition(async () => {
                const result = await renameTag(renameTarget.id, renameValue);
                if (result.ok) {
                  toast.success("Tag renomeada.");
                  setRenameTarget(null);
                  router.refresh();
                } else toast.error(result.message);
              });
            }}
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mergeSource !== null}
        onOpenChange={(open) => !open && setMergeSource(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mesclar “{mergeSource?.name}”</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Mover todos os posts para:</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher tag de destino..." />
                </SelectTrigger>
                <SelectContent>
                  {tags
                    .filter((t) => t.id !== mergeSource?.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              A tag “{mergeSource?.name}” será excluída e seus posts passam a
              usar a tag de destino.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMergeSource(null)}>
                Cancelar
              </Button>
              <Button
                disabled={pending || !mergeTargetId}
                onClick={() =>
                  startTransition(async () => {
                    if (!mergeSource) return;
                    const result = await mergeTags(mergeTargetId, mergeSource.id);
                    if (result.ok) {
                      toast.success("Tags mescladas.");
                      setMergeSource(null);
                      router.refresh();
                    } else toast.error(result.message);
                  })
                }
              >
                Mesclar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
