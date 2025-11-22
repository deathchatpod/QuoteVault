import { Card, CardContent } from "@/components/ui/card";

interface CostDashboardProps {
  totalCost?: number;
  quotesFound?: number;
  quotesVerified?: number;
  processingTime?: number;
}

export function CostDashboard({
  totalCost = 0,
  quotesFound = 0,
  quotesVerified = 0,
  processingTime = 0,
}: CostDashboardProps) {
  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="sticky top-16 z-40 bg-background py-4 -mx-6 px-6 border-b border-border" data-testid="dashboard-cost">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-lg" data-testid="card-api-cost">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="material-icons text-primary text-2xl" aria-hidden="true">
                attach_money
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  API Cost
                </p>
                <p className="text-2xl font-bold font-mono text-foreground" data-testid="text-total-cost">
                  {formatCost(totalCost)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg" data-testid="card-quotes-found">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="material-icons text-primary text-2xl" aria-hidden="true">
                format_quote
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Quotes Found
                </p>
                <p className="text-2xl font-bold font-mono text-foreground" data-testid="text-quotes-found">
                  {quotesFound}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg" data-testid="card-quotes-verified">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="material-icons text-primary text-2xl" aria-hidden="true">
                verified
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Verified
                </p>
                <p className="text-2xl font-bold font-mono text-foreground" data-testid="text-quotes-verified">
                  {quotesVerified}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg" data-testid="card-processing-time">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="material-icons text-primary text-2xl" aria-hidden="true">
                schedule
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Time
                </p>
                <p className="text-2xl font-bold font-mono text-foreground" data-testid="text-processing-time">
                  {formatTime(processingTime)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
