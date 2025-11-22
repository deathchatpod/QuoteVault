import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GoogleSheetsStatusProps {
  connected?: boolean;
  lastExport?: Date | null;
}

export function GoogleSheetsStatus({
  connected = true,
  lastExport = null,
}: GoogleSheetsStatusProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          data-testid="button-sheets-status"
        >
          <span className="material-icons text-lg" aria-hidden="true">
            {connected ? "cloud_done" : "cloud_off"}
          </span>
          <span className="hidden sm:inline">Google Sheets</span>
          <Badge
            variant={connected ? "default" : "destructive"}
            className="text-xs px-2 py-0.5 rounded-full"
          >
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-1">
              Google Sheets Connection
            </h4>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Your account is connected and ready to export quotes."
                : "Please reconnect your Google account to enable exports."}
            </p>
          </div>

          {connected && lastExport && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Last export: <span className="font-mono">{formatDate(lastExport)}</span>
              </p>
            </div>
          )}

          {!connected && (
            <Button size="sm" className="w-full" data-testid="button-reconnect-sheets">
              <span className="material-icons mr-2 text-sm" aria-hidden="true">
                link
              </span>
              Reconnect Google Sheets
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
