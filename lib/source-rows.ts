import type { BusinessInput, SourceRef } from "./types";

type Row = Record<string, unknown>;

/** The same row selection for the owner's proof view and the agent preparing an action. */
export function sourceRows(business: BusinessInput, source: SourceRef): Row[] {
  const keys = new Set(source.keys);
  const months = source.keys.filter((k) => /^\d{4}-\d{2}$/.test(k));
  const str = (value: unknown) => typeof value === "string" ? value : "";
  return ((business[source.table] ?? []) as Row[]).filter((row) => {
    switch (source.table) {
      case "purchases":
        return keys.has(str(row.invoiceNo)) && (!source.item?.trim() || row.item === source.item.trim());
      case "payables":
        return keys.has(str(row.invoiceNo));
      case "bank":
        return keys.has(str(row.reference));
      case "sales":
        return keys.has(str(row.period)) || months.some((m) => str(row.period).startsWith(m));
      case "suppliers":
        return keys.has(str(row.name)) || keys.has(str(row.id));
    }
  });
}
