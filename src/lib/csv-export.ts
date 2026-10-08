export type ExpenseExportRow = { amount: number; category: string; date: string; name: string; owner: string };

// Shared by ReportsHeader and the Expenses page — both export the same
// date/description/category/owner/amount shape, so the CSV serialization and
// download-trigger logic lives here once.
export function downloadExpensesCsv(rows: ExpenseExportRow[], filenameLabel: string) {
  const header = ["Date", "Description", "Category", "Owner", "Amount"];
  const lines = [header, ...rows.map((r) => [r.date, r.name, r.category, r.owner, String(r.amount)])];
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expenses-${filenameLabel.replace(" ", "-").toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
