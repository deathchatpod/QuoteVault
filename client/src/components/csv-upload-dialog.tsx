import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BulkJob {
  id: string;
  filename: string;
  totalQueries: number;
  completedQueries: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export function CSVUploadDialog({ open, onOpenChange }: CSVUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: bulkJob } = useQuery<BulkJob>({
    queryKey: currentJobId ? [`/api/bulk-jobs/${currentJobId}`] : ["/api/bulk-jobs/null"],
    enabled: !!currentJobId,
    refetchInterval: (data) => {
      return data?.status === "processing" ? 3000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { csvContent: string; filename: string }) => {
      return await apiRequest("POST", "/api/bulk-upload", data);
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      toast({
        title: "CSV uploaded",
        description: `Processing ${data.totalQueries} queries...`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload CSV",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      uploadMutation.mutate({
        csvContent,
        filename: file.name,
      });
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setFile(null);
    setCurrentJobId(null);
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
  };

  const progress = bulkJob ? (bulkJob.completedQueries / bulkJob.totalQueries) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk CSV Upload</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: query, searchType (topic/author/work), maxQuotes (1-1000)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!currentJobId ? (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-csv-file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  data-testid="button-select-csv"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select CSV File
                </Button>
                
                {file && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span data-testid="text-selected-filename">{file.name}</span>
                  </div>
                )}
              </div>

              <div className="bg-muted p-4 rounded-md text-sm">
                <p className="font-medium mb-2">CSV Format Example:</p>
                <pre className="text-xs text-muted-foreground">
query,searchType,maxQuotes
{"\n"}Albert Einstein,author,100
{"\n"}Stoicism,topic,200
{"\n"}Hamlet,work,150
                </pre>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-upload">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!file || uploadMutation.isPending}
                  data-testid="button-upload-csv"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload & Process"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Processing Queries</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-bulk-progress">
                    {bulkJob?.completedQueries || 0} / {bulkJob?.totalQueries || 0}
                  </span>
                </div>
                <Progress value={progress} data-testid="progress-bulk-job" />
                
                {bulkJob?.status === "processing" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing in background...</span>
                  </div>
                )}
                
                {bulkJob?.status === "completed" && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span data-testid="text-bulk-completed">All queries processed successfully!</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleClose}
                  disabled={bulkJob?.status === "processing"}
                  data-testid="button-close-bulk"
                >
                  {bulkJob?.status === "processing" ? "Processing..." : "Close"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
