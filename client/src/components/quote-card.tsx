import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Quote } from "@shared/schema";
import { Edit } from "lucide-react";

interface QuoteCardProps {
  quote: Quote;
  onEdit?: (quote: Quote) => void;
}

function VerificationBadge({ quote }: { quote: Quote }) {
  const status = (quote as any).verificationStatus || (quote.verified ? "ai_only" : "unverified");

  const config: Record<string, { label: string; className: string; icon: string }> = {
    cross_verified: {
      label: "Cross-Verified",
      className: "bg-green-100 text-green-800 border-green-300",
      icon: "verified",
    },
    ai_only: {
      label: "AI Verified",
      className: "bg-blue-100 text-blue-800 border-blue-300",
      icon: "psychology",
    },
    single_source: {
      label: "Single Source",
      className: "bg-yellow-100 text-yellow-800 border-yellow-300",
      icon: "info",
    },
    unverified: {
      label: "Unverified",
      className: "bg-gray-100 text-gray-600 border-gray-300",
      icon: "help_outline",
    },
  };

  const c = config[status] || config.unverified;
  const verificationSources = (quote as any).verificationSources as any[] | undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${c.className}`}>
          <span className="material-icons text-xs mr-1" aria-hidden="true">{c.icon}</span>
          {c.label}
        </Badge>
      </TooltipTrigger>
      {verificationSources && verificationSources.length > 0 && (
        <TooltipContent>
          <p className="text-xs font-medium mb-1">Verified by:</p>
          {verificationSources.map((vs: any, i: number) => (
            <p key={i} className="text-xs">{vs.source || vs}</p>
          ))}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function QuoteCard({ quote, onEdit }: QuoteCardProps) {
  const confidenceScore = quote.confidenceScore !== null ? Math.round((quote.confidenceScore ?? 0) * 100) : null;

  const getTypeBadgeColor = (type: string | null) => {
    switch (type) {
      case "religious":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "literature":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "movie":
        return "bg-pink-100 text-pink-800 border-pink-200";
      case "speech":
        return "bg-green-100 text-green-800 border-green-200";
      case "tv":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "music":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Card
      data-testid={`card-quote-${quote.id}`}
      className="relative rounded-lg border-2 hover-elevate active-elevate-2"
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(quote)}
            data-testid={`button-edit-quote-${quote.id}`}
            className="hover-elevate"
          >
            <Edit className="w-4 h-4" />
          </Button>
        )}
        <VerificationBadge quote={quote} />
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="pr-20">
          <p className="text-lg leading-relaxed text-foreground">
            "{quote.quote}"
          </p>
        </div>

        <div className="space-y-2">
          {quote.speaker && (
            <div>
              <span className="text-sm font-semibold text-foreground" data-testid={`text-speaker-${quote.id}`}>
                {quote.speaker}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {quote.author && (
              <div className="flex items-center gap-1">
                <span className="material-icons text-sm" aria-hidden="true">person</span>
                <span data-testid={`text-author-${quote.id}`}>{quote.author}</span>
              </div>
            )}
            {quote.work && (
              <div className="flex items-center gap-1">
                <span className="material-icons text-sm" aria-hidden="true">book</span>
                <span data-testid={`text-work-${quote.id}`}>{quote.work}</span>
              </div>
            )}
            {quote.year && (
              <div className="flex items-center gap-1">
                <span className="material-icons text-sm" aria-hidden="true">calendar_today</span>
                <span data-testid={`text-year-${quote.id}`}>{quote.year}</span>
              </div>
            )}
            {quote.reference && (
              <div className="flex items-center gap-1">
                <span className="material-icons text-sm" aria-hidden="true">link</span>
                <span className="font-mono text-xs" data-testid={`text-reference-${quote.id}`}>
                  {quote.reference}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {confidenceScore !== null && (
            <Badge variant="outline" className="px-3 py-1 text-xs font-semibold rounded-full">
              <span className="material-icons text-xs mr-1" aria-hidden="true">speed</span>
              {confidenceScore}% confidence
            </Badge>
          )}
          {quote.type && (
            <Badge className={`px-3 py-1 text-xs font-semibold rounded-full border ${getTypeBadgeColor(quote.type)}`}>
              {quote.type}
            </Badge>
          )}
          {quote.sources && (quote.sources as string[]).length > 0 && (
            <Badge variant="outline" className="px-3 py-1 text-xs font-semibold rounded-full" title={(quote.sources as string[]).join(", ")}>
              <span className="material-icons text-xs mr-1" aria-hidden="true">merge</span>
              {(quote.sources as string[]).length} source{(quote.sources as string[]).length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
