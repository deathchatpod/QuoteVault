import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Quote } from "@shared/schema";
import { useState } from "react";

interface QuoteTableProps {
  quotes: Quote[];
}

export function QuoteTable({ quotes }: QuoteTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="rounded-lg border-2 border-border overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 bg-muted">
          <TableRow>
            <TableHead className="font-medium w-2/5">Quote</TableHead>
            <TableHead className="font-medium">Speaker</TableHead>
            <TableHead className="font-medium">Author</TableHead>
            <TableHead className="font-medium">Work</TableHead>
            <TableHead className="font-medium">Year</TableHead>
            <TableHead className="font-medium">Sources</TableHead>
            <TableHead className="font-medium text-center">Verified</TableHead>
            <TableHead className="font-medium text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => {
            const isExpanded = expandedRow === quote.id;
            return (
              <TableRow
                key={quote.id}
                data-testid={`row-quote-${quote.id}`}
                className="hover-elevate"
              >
                <TableCell className="py-4">
                  <div className="space-y-1">
                    <p className="text-sm text-foreground leading-relaxed">
                      {isExpanded ? `"${quote.quote}"` : `"${truncate(quote.quote, 120)}"`}
                    </p>
                    {quote.quote.length > 120 && (
                      <button
                        onClick={() => toggleRow(quote.id)}
                        className="text-xs text-primary hover:underline"
                        data-testid={`button-expand-${quote.id}`}
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quote.speaker || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quote.author || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quote.work || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quote.year || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {quote.sources && quote.sources.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {quote.sources.slice(0, 3).map((source, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0.5">
                          {source}
                        </Badge>
                      ))}
                      {quote.sources.length > 3 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          +{quote.sources.length - 3}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {quote.verified ? (
                    <span
                      className="material-icons text-green-600"
                      style={{ fontSize: '20px' }}
                      title="Verified"
                    >
                      check_circle
                    </span>
                  ) : (
                    <span
                      className="material-icons text-amber-600"
                      style={{ fontSize: '20px' }}
                      title="Unverified"
                    >
                      warning
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="outline" className="text-xs px-2 py-1 rounded-full">
                      {quote.sourceConfidence || "medium"}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
