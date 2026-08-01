import { useEffect, useState } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import {
  shortlistContains,
  useSetShortlist,
  useShortlistRecords,
} from "@/features/shortlist/hooks";
import { isEditableTarget } from "@/lib/keyboard";
import { t } from "@/lib/i18n";

export function ShortlistShortcut() {
  const screen = useAppUiStore((state) => state.screen);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const shortlist = useShortlistRecords();
  const mutation = useSetShortlist();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent): void {
      if (
        event.key.toLocaleLowerCase("en-US") !== "s" ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target) ||
        selectedId === null ||
        (screen !== "search" && screen !== "shortlist") ||
        shortlist.isPending ||
        mutation.isPending
      ) {
        return;
      }
      event.preventDefault();
      const saved = shortlistContains(shortlist.data, selectedId);
      mutation.mutate(
        { jobId: selectedId, saved: !saved },
        {
          onError: () => setAnnouncement(t("shortlistMutationError")),
          onSuccess: (state) =>
            setAnnouncement(state.saved ? t("shortlistSaved") : t("shortlistRemoved")),
        },
      );
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [mutation, screen, selectedId, shortlist.data, shortlist.isPending]);

  return (
    <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">
      {announcement}
    </span>
  );
}
