import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ProcessingStatusProps {
  queryId: string;
  currentStage?: "processing" | "searching_apis" | "web_scraping" | "verifying" | "completed";
  progress?: number;
}

export function ProcessingStatus({
  queryId,
  currentStage = "searching_apis",
  progress = 0,
}: ProcessingStatusProps) {
  const stages = [
    { id: "searching_apis", label: "Searching APIs", icon: "cloud_download" },
    { id: "web_scraping", label: "Web Scraping", icon: "web" },
    { id: "verifying", label: "Verifying", icon: "verified" },
    { id: "completed", label: "Complete", icon: "check_circle" },
  ];

  const currentStageIndex = stages.findIndex((s) => s.id === currentStage);

  return (
    <Card className="rounded-lg border-2" data-testid="card-processing-status">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-semibold text-foreground" data-testid="text-processing-title">
          Processing Quote Research
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-6">
        <Progress value={progress} className="h-2" data-testid="progress-bar" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          {stages.map((stage, index) => {
            const isActive = index === currentStageIndex;
            const isComplete = index < currentStageIndex;
            const isPending = index > currentStageIndex;

            return (
              <div key={stage.id} className="flex items-center gap-2" data-testid={`stage-${stage.id}`}>
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : isComplete
                      ? "border-green-500 bg-green-500/10"
                      : "border-muted bg-muted"
                  } ${isActive ? "animate-pulse" : ""}`}
                  data-testid={`icon-${stage.id}`}
                >
                  <span
                    className={`material-icons text-xl ${
                      isActive
                        ? "text-primary"
                        : isComplete
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {stage.icon}
                  </span>
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isActive || isComplete ? "text-foreground" : "text-muted-foreground"
                    }`}
                    data-testid={`text-${stage.id}`}
                  >
                    {stage.label}
                  </p>
                  {isActive && (
                    <Badge variant="secondary" className="text-xs mt-1" data-testid={`badge-${stage.id}-active`}>
                      In Progress
                    </Badge>
                  )}
                  {isComplete && (
                    <Badge className="text-xs mt-1 bg-green-100 text-green-800" data-testid={`badge-${stage.id}-complete`}>
                      Done
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground text-center">
          This may take a few minutes. Please don't close this page.
        </p>
      </CardContent>
    </Card>
  );
}
