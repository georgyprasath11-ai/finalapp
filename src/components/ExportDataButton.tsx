import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportAllQuestions } from "@/question-solver/database/questionStorage";

interface ExportDataButtonProps {
  profileId: string;
}

export function ExportDataButton({ profileId }: ExportDataButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const blob = await exportAllQuestions(profileId);
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "question_solver_data_export.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? "Exporting..." : "Export All Data"}
    </Button>
  );
}
