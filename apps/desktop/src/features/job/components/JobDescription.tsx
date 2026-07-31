import { t } from "@/lib/i18n";
import { parseJobDescription } from "@/features/job/jobDescription";

export function JobDescription({ description }: { description: string }) {
  const blocks = parseJobDescription(description);
  return (
    <div
      className="mt-4 max-w-[75ch] space-y-5 break-words text-[15px] leading-7 text-[var(--text-secondary)]"
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
            <ul className="list-disc space-y-2 pl-5 marker:text-[var(--accent)]" key={index}>
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
              className="rounded-r-[var(--radius-md)] border-l-2 border-[var(--accent)] bg-[var(--accent-muted)] px-4 py-3"
              key={index}
            >
              <strong className="block text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
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
