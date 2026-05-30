"use client";

import { useState } from "react";

export function AvatarFileInput() {
  const [fileName, setFileName] = useState("هنوز تصویری انتخاب نشده است");

  return (
    <div className="space-y-3">
      <label
        htmlFor="avatar-upload"
        className="dashboard-muted-panel flex min-h-24 flex-col items-center justify-center gap-2 border-dashed p-5 text-center transition hover:bg-muted/60"
      >
        <span className="text-sm font-semibold text-foreground">
          انتخاب تصویر پروفایل
        </span>
        <span className="text-xs leading-6 text-muted-foreground">
          برای انتخاب فایل، روی این کادر کلیک کنید.
        </span>
        <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
          {fileName}
        </span>
      </label>
      <input
        id="avatar-upload"
        name="avatar"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        required
        className="sr-only"
        onChange={(event) => {
          setFileName(
            event.currentTarget.files?.[0]?.name ??
              "هنوز تصویری انتخاب نشده است",
          );
        }}
      />
    </div>
  );
}
