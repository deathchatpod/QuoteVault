import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileSpreadsheet } from "lucide-react";

interface ExportFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportFiltersDialog({ open, onOpenChange }: ExportFiltersDialogProps) {
  const [verifiedOnly, setVerifiedOnly] = useState<boolean | undefined>(undefined);
  const [minConfidence, setMinConfidence] = useState<number[]>([0]);
  const [searchType, setSearchType] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const exportMutation = useMutation({
    mutationFn: async (filters: any) => {
      return await apiRequest("POST", "/api/export-filtered", filters);
    },
    onSuccess: (data) => {
      toast({
        title: "Export successful",
        description: "Filtered quotes exported to Google Sheets",
      });
      window.open(data.url, "_blank");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export quotes",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    const filters: any = {};
    
    if (verifiedOnly !== undefined) {
      filters.verified = verifiedOnly;
    }
    
    if (minConfidence[0] > 0) {
      filters.minConfidence = minConfidence[0] / 100;
    }
    
    if (searchType && searchType !== "all") {
      filters.searchType = searchType;
    }
    
    exportMutation.mutate(filters);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export with Filters</DialogTitle>
          <DialogDescription>
            Select criteria to filter quotes before exporting to Google Sheets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="verified-filter">Verified Quotes Only</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {verifiedOnly === undefined ? "All" : verifiedOnly ? "Yes" : "No"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (verifiedOnly === undefined) setVerifiedOnly(true);
                    else if (verifiedOnly === true) setVerifiedOnly(false);
                    else setVerifiedOnly(undefined);
                  }}
                  data-testid="button-toggle-verified-filter"
                >
                  Toggle
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="confidence-filter">Minimum Confidence Score</Label>
                <span className="text-sm text-muted-foreground" data-testid="text-confidence-value">
                  {minConfidence[0]}%
                </span>
              </div>
              <Slider
                id="confidence-filter"
                data-testid="slider-min-confidence"
                min={0}
                max={100}
                step={5}
                value={minConfidence}
                onValueChange={setMinConfidence}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-filter">Quote Type</Label>
              <Select value={searchType || "all"} onValueChange={setSearchType}>
                <SelectTrigger id="type-filter" data-testid="select-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="literature">Literature</SelectItem>
                  <SelectItem value="religious">Religious Text</SelectItem>
                  <SelectItem value="speech">Speech</SelectItem>
                  <SelectItem value="dialogue">Dialogue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-export"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              data-testid="button-export-filtered"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exportMutation.isPending ? "Exporting..." : "Export to Sheets"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
