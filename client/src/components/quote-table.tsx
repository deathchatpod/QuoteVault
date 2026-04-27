import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Quote } from "@shared/schema";
import { useState } from "react";

interface QuoteTableProps {
  quotes: Quote[];
}

function VerificationStatusBadge({ quote }: { quote: Quote }) {
  const status = (quote as any).verificationStatus || (quote.verified ? "ai_only" : "unverified");

  const config: Record<string, { label: string; className: string }> = {
    cross_verified: {
      label: "Cross-Verified",
      className: "bg-green-100 text-green-800 border-green-300",
    },
    ai_only: {
      label: "AI Verified",
      className: "bg-blue-100 text-blue-800 border-blue-300",
    },
    single_source: {
      label: "Single Source",
      className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    },
    unverified: {
      label: "Unverified",
      className: "bg-gray-100 text-gray-600 border-gray-300",
    },
  };

  const c = config[status] || config.unverified;
  const verificationSources = (quote as any).verificationSources as any[] | undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`text-xs px-2 py-0.5 border ${c.className}`}>
          {c.label}
        </Badge>
      </TooltipTrigger>
      {verificationSources && verificationSources.length > 0 && (
        <TooltipContent>
          <p className="text-xs font-medium mb-1">Sources:</p>
          {verificationSources.map((vs: any, i: number) => (
            <p key={i} className="text-xs">{vs.source || vs}</p>
          ))}
        </TooltipContent>
      )}
    </Tooltip>
  );
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
            <TableHead className="font-medium text-center">Status</TableHead>
            <TableHead className="font-medium text-center">Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => {
            const isExpanded = expandedRow === quote.id;
            const confidenceScore = quote.confidenceScore !== null ? Math.round((quote.confidenceScore ?? 0) * 100) : null;
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
                  {quote.speaker || "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quote.author || "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quote.work || "\u2014"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quote.year || "\u2014"}
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
                    "\u2014"
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <VerificationStatusBadge quote={quote} />
                </TableCell>
                <TableCell className="text-center">
                  {confidenceScore !== null && (
                    <Badge variant="outline" className="text-xs px-2 py-1 rounded-full">
                      {confidenceScore}%
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
