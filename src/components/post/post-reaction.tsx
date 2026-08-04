"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { togglePostReaction } from "@/app/(member)/actions";

export function PostReaction({
  postId,
  initialCount,
  initialReacted,
}: {
  postId: string;
  initialCount: number;
  initialReacted: boolean;
}) {
  const [reacted, setReacted] = useState(initialReacted);
  const [count, setCount] = useState(initialCount);
  const [, startTransition] = useTransition();

  return (
    <Button
      variant={reacted ? "secondary" : "outline"}
      size="sm"
      onClick={() => {
        const next = !reacted;
        setReacted(next);
        setCount((c) => c + (next ? 1 : -1));
        startTransition(() => togglePostReaction(postId, next).catch(() => {}));
      }}
    >
      <Heart className={reacted ? "size-4 fill-current" : "size-4"} />
      {count > 0 ? count : "Curtir"}
    </Button>
  );
}
