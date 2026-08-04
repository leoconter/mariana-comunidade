"use client";

import { useEffect, useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  markPostSeen,
  setSavedPost,
} from "@/app/(member)/actions";

/** Save-for-later toggle + marks the post as seen on mount. */
export function PostToolbar({
  postId,
  initialSaved,
}: {
  postId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  useEffect(() => {
    markPostSeen(postId).catch(() => {});
  }, [postId]);

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size="sm"
      onClick={() => {
        const next = !saved;
        setSaved(next);
        startTransition(async () => {
          try {
            await setSavedPost(postId, next);
            toast.success(next ? "Post salvo." : "Post removido dos salvos.");
          } catch {
            setSaved(!next);
          }
        });
      }}
    >
      <Bookmark className={saved ? "size-4 fill-current" : "size-4"} />
      {saved ? "Salvo" : "Salvar"}
    </Button>
  );
}
