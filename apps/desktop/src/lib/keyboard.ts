export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const editableAncestor = target.closest<HTMLElement>("[contenteditable]");
  return (
    target.matches("input, textarea, select") ||
    target.isContentEditable ||
    (editableAncestor !== null && editableAncestor.contentEditable !== "false")
  );
}
