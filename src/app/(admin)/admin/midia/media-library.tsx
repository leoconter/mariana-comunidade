"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { VideoUploadButton } from "@/components/admin/video-upload-button";
import type { Tables } from "@/lib/database.types";
import { formatBytes, KIND_LABELS, type MediaKind } from "@/lib/media";
import { uploadToMediaBucket } from "@/lib/upload";
import { deleteMedia, registerMedia, renameMedia } from "./actions";
import { refreshVideoStatus } from "./video-actions";

type Asset = Tables<"media_assets"> & {
  post_attachments: { post_id: string; posts: { id: string; title: string } | null }[];
};

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: ImageIcon,
  video: Film,
  doc: FileText,
  sheet: FileSpreadsheet,
  other: Paperclip,
};

const FILTERS: { value: MediaKind | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pdf", label: "PDFs" },
  { value: "video", label: "Vídeos" },
  { value: "image", label: "Imagens" },
  { value: "doc", label: "Documentos" },
  { value: "sheet", label: "Planilhas" },
];

export function MediaLibrary({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MediaKind | "all">("all");
  const [renameTarget, setRenameTarget] = useState<Asset | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (filter !== "all" && asset.kind !== filter) return false;
      if (!q) return true;
      return (
        asset.title.toLowerCase().includes(q) ||
        asset.filename.toLowerCase().includes(q)
      );
    });
  }, [assets, search, filter]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = await uploadToMediaBucket(file);
        const result = await registerMedia({
          storagePath: path,
          filename: file.name,
          mime: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        if (!result.ok) throw new Error(result.message);
      }
      toast.success(
        files.length === 1
          ? "Arquivo enviado."
          : `${files.length} arquivos enviados.`
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha no upload do arquivo."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,application/pdf,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Enviando..." : "Enviar arquivos"}
        </Button>
        <VideoUploadButton onUploaded={() => router.refresh()} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="max-w-xs"
        />
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                filter === f.value
                  ? "bg-secondary font-medium text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          {assets.length === 0
            ? "Nenhum arquivo enviado ainda. Comece clicando em “Enviar arquivos”."
            : "Nenhum arquivo corresponde à busca."}
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {filtered.map((asset) => {
            const Icon = KIND_ICONS[asset.kind] ?? Paperclip;
            const usage = asset.post_attachments.length;
            return (
              <li key={asset.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{asset.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {asset.filename} · {formatBytes(asset.size_bytes)}
                    {usage > 0 && (
                      <>
                        {" "}
                        · usado em{" "}
                        {usage === 1
                          ? `“${asset.post_attachments[0].posts?.title || "1 post"}”`
                          : `${usage} posts`}
                      </>
                    )}
                  </p>
                </div>
                {asset.kind === "video" && asset.bunny_status !== "ready" && (
                  <Badge
                    variant={
                      asset.bunny_status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {asset.bunny_status === "failed"
                      ? "Falhou"
                      : "Processando"}
                  </Badge>
                )}
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {KIND_LABELS[asset.kind as MediaKind] ?? asset.kind}
                </Badge>
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
                        setRenameTarget(asset);
                        setRenameValue(asset.title);
                      }}
                    >
                      <Pencil className="size-4" /> Renomear
                    </DropdownMenuItem>
                    {asset.kind === "video" &&
                      asset.bunny_status !== "ready" && (
                        <DropdownMenuItem
                          onClick={() =>
                            startTransition(async () => {
                              await refreshVideoStatus(asset.id);
                              router.refresh();
                            })
                          }
                        >
                          <Film className="size-4" /> Atualizar status
                        </DropdownMenuItem>
                      )}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteMedia(asset.id);
                          if (result.ok) {
                            toast.success("Arquivo excluído.");
                            router.refresh();
                          } else {
                            toast.error(result.message);
                          }
                        })
                      }
                    >
                      <Trash2 className="size-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear arquivo</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!renameTarget) return;
              startTransition(async () => {
                const result = await renameMedia(renameTarget.id, renameValue);
                if (result.ok) {
                  toast.success("Arquivo renomeado.");
                  setRenameTarget(null);
                  router.refresh();
                } else {
                  toast.error(result.message);
                }
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
    </div>
  );
}
