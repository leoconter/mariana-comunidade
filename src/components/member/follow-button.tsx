"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setFollowSpace } from "@/app/(member)/actions";

export function FollowButton({
  spaceId,
  initialFollowing,
}: {
  spaceId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={following ? "secondary" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() => {
        const next = !following;
        setFollowing(next);
        startTransition(async () => {
          try {
            await setFollowSpace(spaceId, next);
          } catch {
            setFollowing(!next);
          }
        });
      }}
    >
      {following ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      {following ? "Seguindo" : "Seguir"}
    </Button>
  );
}
