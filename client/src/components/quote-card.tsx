import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Quote } from "@shared/schema";

interface QuoteCardProps {
  quote: Quote;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const getConfidenceBadgeVariant = (confidence: string | null) => {
    switch (confidence) {
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

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
      case "poem":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "historical":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Card
      data-testid={`card-quote-${quote.id}`}
      className="relative rounded-lg border-2 hover-elevate active-elevate-2"
    >
      <div className="absolute top-4 right-4">
        {quote.verified ? (
          <span
            className="material-icons text-green-600"
            style={{ fontSize: '24px' }}
            title="Verified"
            aria-label="Verified quote"
          >
            check_circle
          </span>
        ) : (
          <span
            className="material-icons text-amber-600"
            style={{ fontSize: '24px' }}
            title="Unverified"
            aria-label="Unverified quote"
          >
            warning
          </span>
        )}
      </div>

      <CardContent className="p-6 space-y-4">
        <div className="pr-8">
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
          {quote.sourceConfidence && (
            <Badge variant={getConfidenceBadgeVariant(quote.sourceConfidence)} className="px-3 py-1 text-xs font-semibold rounded-full">
              {quote.sourceConfidence} confidence
            </Badge>
          )}
          {quote.type && (
            <Badge className={`px-3 py-1 text-xs font-semibold rounded-full border ${getTypeBadgeColor(quote.type)}`}>
              {quote.type}
            </Badge>
          )}
          {quote.sources && (quote.sources as string[]).length > 1 && (
            <Badge variant="outline" className="px-3 py-1 text-xs font-semibold rounded-full">
              <span className="material-icons text-xs mr-1" aria-hidden="true">merge</span>
              {(quote.sources as string[]).length} sources
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
