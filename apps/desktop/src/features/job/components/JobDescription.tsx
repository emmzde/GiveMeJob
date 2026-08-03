import { t } from "@/lib/i18n";
import { parseJobDescription } from "@/features/job/jobDescription";

export function JobDescription({ description }: { description: string }) {
  const blocks = parseJobDescription(description);
  return (
    <div
      className="mt-3 max-w-[75ch] space-y-4 break-words text-[13px] leading-6 text-[var(--text-secondary)]"
      data-testid="job-description"
    >
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h4 className="text-sm font-semibold text-[var(--text)]" key={index}>
              {block.text}
            </h4>
          );
        }
        if (block.kind === "list") {
          return (
            <ul className="list-disc space-y-2 pl-5 marker:text-[var(--text-tertiary)]" key={index}>
              {block.items.map((item, itemIndex) => (
                <li className="pl-1" key={`${item}-${itemIndex}`}>
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "note") {
          return (
            <aside
              className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-secondary)] px-3 py-2.5"
              key={index}
            >
              <strong className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {t("note")}
              </strong>
              <p className="mt-1 text-[var(--text)]">{block.text}</p>
            </aside>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
