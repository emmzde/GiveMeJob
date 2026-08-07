import { Bookmark } from "lucide-react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  shortlistContains,
  useSetShortlist,
  useShortlistRecords,
} from "@/features/shortlist/hooks";
import type { JobId } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ShortlistButton({
  compact = false,
  jobId,
}: {
  compact?: boolean;
  jobId: JobId;
}) {
  const shortlist = useShortlistRecords();
  const mutation = useSetShortlist();
  const saved = shortlistContains(shortlist.data, jobId);
  const label = saved ? t("removeFromShortlist") : t("saveToShortlist");

  function toggle(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    if (mutation.isPending) return;
    mutation.mutate({ jobId, saved: !saved });
  }

  return (
    <span className={cn("inline-flex min-w-0 flex-col", compact && "items-end")}>
      <Button
        aria-label={label}
        aria-pressed={saved}
        className={cn("group", compact && "size-8 px-0")}
        disabled={shortlist.isPending || mutation.isPending}
        onClick={toggle}
        title={mutation.isError ? t("shortlistMutationError") : label}
        type="button"
        variant={saved ? "outline" : "ghost"}
      >
        <Bookmark
          aria-hidden="true"
          className="size-4 transition-[transform,fill] duration-300 ease-[var(--ease)] group-aria-pressed:scale-105"
          fill={saved ? "currentColor" : "none"}
        />
        {compact ? null : label}
      </Button>
      {mutation.isError ? (
        <span
          className={compact ? "sr-only" : "mt-1 text-[10px] text-[var(--danger)]"}
          role="alert"
        >
          {t("shortlistMutationError")}
        </span>
      ) : null}
    </span>
  );
}
