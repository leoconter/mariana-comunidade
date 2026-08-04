"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VideoUploadButton } from "@/components/admin/video-upload-button";
import type { Tables } from "@/lib/database.types";
import { formatBytes, KIND_LABELS, type MediaKind } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { uploadToMediaBucket } from "@/lib/upload";
import { registerMedia } from "../../midia/actions";
import { addAttachment, removeAttachment } from "../actions";

export type AttachmentWithMedia = Tables<"post_attachments"> & {
  media_assets: Tables<"media_assets"> | null;
};

type LibraryAsset = Pick<
  Tables<"media_assets">,
  "id" | "title" | "filename" | "kind" | "size_bytes"
>;

export function AttachmentsPanel({
  postId,
  attachments,
}: {
  postId: string;
  attachments: AttachmentWithMedia[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (!result.ok || !result.id) throw new Error(result.message);
        await addAttachment(postId, result.id);
      }
      toast.success("Anexo adicionado.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao anexar arquivo."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Anexos</p>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,application/pdf,image/*"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Enviar novo
          </Button>
          <VideoUploadButton
            label="Vídeo"
            onUploaded={async (mediaId) => {
              await addAttachment(postId, mediaId);
              router.refresh();
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="size-4" /> Da biblioteca
          </Button>
        </div>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo. PDFs, imagens e planilhas anexados aparecem para as
          membras com visualização e download.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((attachment) => {
            const media = attachment.media_assets;
            if (!media) return null;
            return (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{media.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {KIND_LABELS[media.kind as MediaKind] ?? media.kind} ·{" "}
                    {formatBytes(media.size_bytes)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeAttachment(attachment.id, postId);
                      router.refresh();
                    })
                  }
                >
                  <X className="size-4" />
                  <span className="sr-only">Remover anexo</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <LibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={attachments.map((a) => a.media_id)}
        onPick={(mediaId) =>
          startTransition(async () => {
            await addAttachment(postId, mediaId);
            setPickerOpen(false);
            toast.success("Anexo adicionado.");
            router.refresh();
          })
        }
      />
    </div>
  );
}

function LibraryPicker({
  open,
  onOpenChange,
  excludeIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onPick: (mediaId: string) => void;
}) {
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("media_assets")
      .select("id, title, filename, kind, size_bytes")
      .is("deleted_at", null)
      .neq("kind", "video")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setAssets(data ?? []));
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = (assets ?? []).filter(
    (a) =>
      !excludeIds.includes(a.id) &&
      (!q ||
        a.title.toLowerCase().includes(q) ||
        a.filename.toLowerCase().includes(q))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar da biblioteca</DialogTitle>
        </DialogHeader>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar arquivo..."
        />
        {assets === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando...
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum arquivo disponível.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((asset) => (
              <li key={asset.id}>
                <button
                  onClick={() => onPick(asset.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
                >
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{asset.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {KIND_LABELS[asset.kind as MediaKind] ?? asset.kind} ·{" "}
                      {formatBytes(asset.size_bytes)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
