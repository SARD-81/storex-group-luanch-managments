"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  user: {
    id: string;
    name: string;
    avatarUpdatedAt?: Date | string | null;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-20 text-xl",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials || "ک";
}

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const src = useMemo(() => {
    const baseSrc = `/api/users/avatar/${user.id}`;

    if (!user.avatarUpdatedAt) {
      return baseSrc;
    }

    return `${baseSrc}?v=${new Date(user.avatarUpdatedAt).getTime()}`;
  }, [user.avatarUpdatedAt, user.id]);
  const initials = getInitials(user.name);

  if (hasImageError) {
    return (
      <div
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/70 font-bold text-foreground shadow-sm",
          sizeClasses[size],
          className,
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={user.name}
      className={cn(
        "inline-flex shrink-0 rounded-full border border-border/60 bg-muted/70 object-cover shadow-sm",
        sizeClasses[size],
        className,
      )}
      onError={() => setHasImageError(true)}
    />
  );
}
