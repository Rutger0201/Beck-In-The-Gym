// Read-only inspection for migration planning. No writes, recalculations or renumbering.
export function inspectLegacyBackup(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid backup");
  const backup = value as Record<string, unknown>;
  if (backup.app !== "beck-documenten" || backup.versie !== 1 || !backup.documenten || typeof backup.documenten !== "object" || Array.isArray(backup.documenten)) throw new Error("Unsupported backup format");
  const documents = Object.entries(backup.documenten as Record<string, unknown>);
  if (documents.length > 10000) throw new Error("Backup exceeds review limit");
  return {
    version: 1,
    count: documents.length,
    documents: documents.map(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid document");
      const doc = value as Record<string, unknown>;
      return { legacyNumber: key, type: String(doc.type || "unknown"), status: String(doc.status || "unknown"), numberMismatch: doc.nummer !== key, requiresPdfReconciliation: true };
    }),
    warnings: ["Amounts cannot be reconstructed reliably without the original PDFs and historical settings.", "No document has been imported or changed."]
  };
}
