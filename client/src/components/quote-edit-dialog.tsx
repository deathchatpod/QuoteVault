import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Quote } from "@shared/schema";

interface QuoteEditDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteEditDialog({ quote, open, onOpenChange }: QuoteEditDialogProps) {
  const [speaker, setSpeaker] = useState("");
  const [author, setAuthor] = useState("");
  const [work, setWork] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState<string>("");
  const [reference, setReference] = useState("");
  const [verified, setVerified] = useState(false);
  const [sourceConfidence, setSourceConfidence] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && quote) {
      setSpeaker(quote.speaker || "");
      setAuthor(quote.author || "");
      setWork(quote.work || "");
      setYear(quote.year || "");
      setType(quote.type || "");
      setReference(quote.reference || "");
      setVerified(quote.verified);
      setSourceConfidence(quote.sourceConfidence || "");
    }
  }, [open, quote]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/quotes/${quote?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Quote updated",
        description: "Quote has been successfully updated",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update quote",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updates: any = {};
    
    if (speaker !== (quote?.speaker || "")) {
      updates.speaker = speaker || null;
    }
    if (author !== (quote?.author || "")) {
      updates.author = author || null;
    }
    if (work !== (quote?.work || "")) {
      updates.work = work || null;
    }
    if (year !== (quote?.year || "")) {
      updates.year = year || null;
    }
    if (type !== (quote?.type || "")) {
      updates.type = (type && type !== "none") ? type : null;
    }
    if (reference !== (quote?.reference || "")) {
      updates.reference = reference || null;
    }
    if (verified !== quote?.verified) {
      updates.verified = verified;
    }
    if (sourceConfidence !== (quote?.sourceConfidence || "")) {
      updates.sourceConfidence = (sourceConfidence && sourceConfidence !== "unset") ? sourceConfidence : null;
    }
    
    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes",
        description: "No fields were modified.",
      });
      onOpenChange(false);
      return;
    }
    
    updateMutation.mutate(updates);
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quote</DialogTitle>
          <DialogDescription>Update quote attribution and metadata</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-quote-text">Quote Text</Label>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md" data-testid="edit-quote-text">
              {quote.quote}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-speaker">Speaker</Label>
              <Input
                id="edit-speaker"
                data-testid="input-edit-speaker"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder="Who said it"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-author">Author</Label>
              <Input
                id="edit-author"
                data-testid="input-edit-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Who wrote it"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-work">Work</Label>
              <Input
                id="edit-work"
                data-testid="input-edit-work"
                value={work}
                onChange={(e) => setWork(e.target.value)}
                placeholder="Book, speech, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-year">Year</Label>
              <Input
                id="edit-year"
                data-testid="input-edit-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="YYYY"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-type">Type</Label>
            <Select value={type || "none"} onValueChange={setType}>
              <SelectTrigger id="edit-type" data-testid="select-edit-type">
                <SelectValue placeholder={quote.type || "Not specified"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                <SelectItem value="literature">Literature</SelectItem>
                <SelectItem value="religious">Religious Text</SelectItem>
                <SelectItem value="speech">Speech</SelectItem>
                <SelectItem value="dialogue">Dialogue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reference">Reference</Label>
            <Input
              id="edit-reference"
              data-testid="input-edit-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Chapter, verse, page number, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-source-confidence">Source Confidence</Label>
            <Select value={sourceConfidence || "unset"} onValueChange={(v: any) => setSourceConfidence(v)}>
              <SelectTrigger id="edit-source-confidence" data-testid="select-edit-confidence">
                <SelectValue placeholder={quote.sourceConfidence || "Not set"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not set</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-verified">Verified</Label>
            <Switch
              id="edit-verified"
              data-testid="switch-edit-verified"
              checked={verified}
              onCheckedChange={setVerified}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
