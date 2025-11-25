import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Quote, SearchQuery } from "@shared/schema";
import { QuoteCard } from "@/components/quote-card";
import { QuoteTable } from "@/components/quote-table";
import { CostDashboard } from "@/components/cost-dashboard";
import { ProcessingStatus } from "@/components/processing-status";
import { GoogleSheetsStatus } from "@/components/google-sheets-status";
import { QuoteEditDialog } from "@/components/quote-edit-dialog";
import { CSVUploadDialog } from "@/components/csv-upload-dialog";
import { ExportFiltersDialog } from "@/components/export-filters-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileSpreadsheet, ChevronDown } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"topic" | "author" | "work">("topic");
  const [maxQuotes, setMaxQuotes] = useState<number[]>([250]);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [showExportFilters, setShowExportFilters] = useState(false);
  const [searchFormOpen, setSearchFormOpen] = useState(true);
  const [selectedQueryFilter, setSelectedQueryFilter] = useState<string | null>(null);
  const [statusToastId, setStatusToastId] = useState<string | null>(null);
  const { toast, dismiss } = useToast();
  const resultsRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef<HTMLDivElement>(null);

  const { data: quotes, isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: allQueries } = useQuery<SearchQuery[]>({
    queryKey: ["/api/queries"],
  });

  const { data: queryQuotes } = useQuery<Quote[]>({
    queryKey: selectedQueryFilter ? [`/api/queries/${selectedQueryFilter}/quotes`] : ["/api/queries/null/quotes"],
    enabled: !!selectedQueryFilter,
  });

  const { data: currentQuery } = useQuery<SearchQuery>({
    queryKey: currentQueryId ? [`/api/queries/${currentQueryId}`] : ["/api/queries/null"],
    enabled: !!currentQueryId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" || status === "searching_apis" || status === "web_scraping" || status === "verifying" ? 2000 : false;
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (data: { query: string; searchType: string; maxQuotes: number }) => {
      const result = await apiRequest("POST", "/api/search", data);
      return result as unknown as { queryId: string };
    },
    onSuccess: (data) => {
      setCurrentQueryId(data.queryId);
      queryClient.invalidateQueries({ queryKey: ["/api/queries"] });
      toast({
        title: "Search started",
        description: "Processing your quote research request...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Search failed",
        description: error.message || "Failed to start search",
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/quotes/verify", {});
      return result as unknown as { verified: number; total: number; totalCost: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Verification complete",
        description: `Verified ${data.verified} of ${data.total} quotes (Cost: $${data.totalCost.toFixed(4)})`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify quotes",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/quotes/export", {});
    },
    onSuccess: (data) => {
      toast({
        title: "Export successful",
        description: "Quotes exported to Google Sheets",
      });
      window.open(data.url, "_blank");
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export to Google Sheets",
        variant: "destructive",
      });
    },
  });

  const dumpAllMutation = useMutation({
    mutationFn: async (maxPerSource: number = 50) => {
      const result = await apiRequest("POST", "/api/dump-all", { maxPerSource });
      return result as unknown as { queryId: string; message: string };
    },
    onSuccess: (data) => {
      setCurrentQueryId(data.queryId);
      queryClient.invalidateQueries({ queryKey: ["/api/queries"] });
      toast({
        title: "Dump All Started",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Dump All Failed",
        description: error.message || "Failed to dump all sources",
        variant: "destructive",
      });
    },
  });

  const isProcessing = (currentQueryId && !currentQuery) || currentQuery?.status === "processing" || currentQuery?.status === "searching_apis" || currentQuery?.status === "web_scraping" || currentQuery?.status === "verifying";
  const hasQuotes = quotes && quotes.length > 0;
  
  const filteredQuotes = selectedQueryFilter && queryQuotes
    ? queryQuotes
    : quotes || [];

  useEffect(() => {
    if (currentQuery?.status === "completed") {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/queries"] });
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 500);
    }
  }, [currentQuery?.status]);

  useEffect(() => {
    if (isProcessing) {
      setSearchFormOpen(false);
    }
  }, [isProcessing]);

  useEffect(() => {
    if (isProcessing && currentQuery && processingRef.current) {
      setTimeout(() => {
        processingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [isProcessing, currentQuery]);

  useEffect(() => {
    if (currentQuery) {
      if (statusToastId) {
        dismiss(statusToastId);
      }

      let title = "";
      let description = "";
      let icon = "";

      if (currentQuery.status === "processing" || currentQuery.status === "searching_apis") {
        title = "🔍 Searching for quotes...";
        description = "Checking multiple quote sources";
      } else if (currentQuery.status === "web_scraping") {
        title = "🌐 Web scraping in progress...";
        description = "Gathering quotes from Wikiquote and other sources";
      } else if (currentQuery.status === "verifying") {
        title = "✓ Verifying quotes...";
        description = "Using AI to verify accuracy and attribution";
      } else if (currentQuery.status === "completed") {
        title = "✅ Search completed!";
        description = `Found ${currentQuery.quotesFound || 0} quotes`;
        
        const { id } = toast({
          title,
          description,
          duration: 5000,
        });
        setStatusToastId(id);
        return;
      }

      if (currentQuery.status !== "completed") {
        const { id } = toast({
          title,
          description,
          duration: Infinity,
        });
        setStatusToastId(id);
      }
    }
  }, [currentQuery?.status]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    searchMutation.mutate({
      query,
      searchType,
      maxQuotes: maxQuotes[0],
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-3">
          <span className="material-icons text-primary text-3xl" aria-hidden="true">format_quote</span>
          <h1 className="text-xl font-semibold text-foreground">Quote Research & Verification</h1>
        </div>
        <GoogleSheetsStatus />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Collapsible open={searchFormOpen} onOpenChange={setSearchFormOpen} className="mb-8">
          <Card className="rounded-lg border-2">
            <CollapsibleTrigger asChild>
              <CardHeader className="p-6 cursor-pointer hover-elevate">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold text-foreground">Search for Quotes</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-2">
                      Find and verify quotes by topic, author, or work. Search across multiple sources including public APIs and web scraping.
                    </CardDescription>
                  </div>
                  <ChevronDown 
                    className={`h-5 w-5 text-muted-foreground transition-transform ${searchFormOpen ? "" : "-rotate-90"}`}
                    data-testid="icon-toggle-search-form"
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-6 pt-0 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-query" className="text-sm font-medium text-foreground">
                  Search Query
                </Label>
                <Input
                  id="search-query"
                  data-testid="input-search-query"
                  placeholder="Enter a topic, author name, or work title..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="py-2 px-4 rounded-md border-2 text-base"
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Examples: "love", "Shakespeare", "The Great Gatsby"
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="search-type" className="text-sm font-medium text-foreground">
                  Search Type
                </Label>
                <Select value={searchType} onValueChange={(v) => setSearchType(v as any)} disabled={isProcessing}>
                  <SelectTrigger id="search-type" data-testid="select-search-type" className="py-2 px-4 rounded-md border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topic" data-testid="option-topic">Topic</SelectItem>
                    <SelectItem value="author" data-testid="option-author">Author</SelectItem>
                    <SelectItem value="work" data-testid="option-work">Work</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose how to search for quotes
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="max-quotes" className="text-sm font-medium text-foreground">
                    Maximum Quotes
                  </Label>
                  <Input
                    type="number"
                    data-testid="input-max-quotes-number"
                    value={maxQuotes[0]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 10;
                      setMaxQuotes([Math.min(Math.max(val, 10), 1000)]);
                    }}
                    min={10}
                    max={1000}
                    disabled={isProcessing}
                    className="w-24 text-center font-mono font-semibold"
                  />
                </div>
                <Slider
                  id="max-quotes"
                  data-testid="slider-max-quotes"
                  value={maxQuotes}
                  onValueChange={setMaxQuotes}
                  min={10}
                  max={1000}
                  step={10}
                  disabled={isProcessing}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Up to 1,000 quotes per search
                </p>
              </div>
            </div>

                <Button
                  data-testid="button-start-search"
                  onClick={handleSearch}
                  disabled={!query.trim() || isProcessing || searchMutation.isPending}
                  size="lg"
                  className="w-full py-3 px-8 rounded-md font-semibold"
                >
                  <span className="material-icons mr-2" aria-hidden="true">search</span>
                  {isProcessing || searchMutation.isPending ? "Processing..." : "Start Research"}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {isProcessing && (
          <div ref={processingRef}>
            <Card className="mb-8 rounded-lg border-2 border-primary bg-primary/5" data-testid="card-processing">
              <CardHeader className="p-6">
                <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <span className="material-icons text-primary animate-spin" aria-hidden="true">autorenew</span>
                  Search In Progress
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground mt-2">
                  Processing your request across multiple sources. This may take up to 60 seconds.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {currentQuery ? (
                  <ProcessingStatus
                    queryId={currentQuery.id}
                    currentStage={currentQuery.status as any}
                    progress={
                      currentQuery.status === "processing" ? 10 :
                      currentQuery.status === "searching_apis" ? 25 :
                      currentQuery.status === "web_scraping" ? 50 :
                      currentQuery.status === "verifying" ? 75 : 10
                    }
                  />
                ) : (
                  <div className="flex items-center gap-3 py-4">
                    <span className="material-icons text-primary animate-spin">hourglass_empty</span>
                    <p className="text-sm text-muted-foreground">Initializing search...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentQuery?.status === "completed" && (
          <>
            <CostDashboard
              totalCost={currentQuery.apiCost}
              quotesFound={currentQuery.quotesFound}
              quotesVerified={currentQuery.quotesVerified}
              processingTime={currentQuery.processingTimeMs || 0}
            />
            <Separator className="my-8" />
          </>
        )}

        {quotesLoading && (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-60 w-full rounded-lg" />
              <Skeleton className="h-60 w-full rounded-lg" />
              <Skeleton className="h-60 w-full rounded-lg" />
              <Skeleton className="h-60 w-full rounded-lg" />
            </div>
          </div>
        )}

        {!quotesLoading && hasQuotes && (
          <div ref={resultsRef}>
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-foreground">Results</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-csv-upload"
                    onClick={() => setShowCsvUpload(true)}
                  >
                    <Upload className="mr-2 w-4 h-4" />
                    Bulk CSV Upload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-export-filtered"
                    onClick={() => setShowExportFilters(true)}
                  >
                    <FileSpreadsheet className="mr-2 w-4 h-4" />
                    Export with Filters
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-export-sheets"
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending}
                  >
                    <span className="material-icons mr-2 text-lg" aria-hidden="true">cloud_upload</span>
                    {exportMutation.isPending ? "Exporting..." : "Export All"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-verify-all"
                    onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending}
                  >
                    <span className="material-icons mr-2 text-lg" aria-hidden="true">verified</span>
                    {verifyMutation.isPending ? "Verifying..." : "Verify All"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    data-testid="button-dump-all"
                    onClick={() => dumpAllMutation.mutate(50)}
                    disabled={dumpAllMutation.isPending || isProcessing}
                  >
                    <span className="material-icons mr-2 text-lg" aria-hidden="true">download</span>
                    {dumpAllMutation.isPending ? "Dumping..." : "Dump All Sources"}
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="table" className="w-full">
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                  <TabsTrigger value="cards" data-testid="tab-cards">
                    <span className="material-icons mr-2 text-sm" aria-hidden="true">view_module</span>
                    Cards
                  </TabsTrigger>
                  <TabsTrigger value="table" data-testid="tab-table">
                    <span className="material-icons mr-2 text-sm" aria-hidden="true">table_chart</span>
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="queries" data-testid="tab-queries">
                    <span className="material-icons mr-2 text-sm" aria-hidden="true">history</span>
                    By Query
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="cards" className="mt-6">
                  {selectedQueryFilter && (
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Filtered by query:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedQueryFilter(null)}
                        data-testid="button-clear-filter"
                      >
                        <span className="material-icons mr-1 text-sm">close</span>
                        Clear Filter
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredQuotes.map((quote) => (
                      <QuoteCard key={quote.id} quote={quote} onEdit={setEditingQuote} />
                    ))}
                  </div>
                  {selectedQueryFilter && filteredQuotes.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No quotes found for this query</p>
                  )}
                </TabsContent>
                <TabsContent value="table" className="mt-6">
                  {selectedQueryFilter && (
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Filtered by query:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedQueryFilter(null)}
                        data-testid="button-clear-filter"
                      >
                        <span className="material-icons mr-1 text-sm">close</span>
                        Clear Filter
                      </Button>
                    </div>
                  )}
                  <QuoteTable quotes={filteredQuotes} />
                  {selectedQueryFilter && filteredQuotes.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No quotes found for this query</p>
                  )}
                </TabsContent>
                <TabsContent value="queries" className="mt-6">
                  {allQueries && allQueries.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 text-sm font-semibold text-foreground">Query</th>
                            <th className="text-left p-3 text-sm font-semibold text-foreground">Search Type</th>
                            <th className="text-right p-3 text-sm font-semibold text-foreground">Results</th>
                            <th className="text-right p-3 text-sm font-semibold text-foreground">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allQueries
                            .filter(q => q.status === "completed")
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map((query) => (
                            <tr 
                              key={query.id}
                              onClick={() => {
                                setSelectedQueryFilter(query.id);
                              }}
                              className="border-b hover-elevate cursor-pointer"
                              data-testid={`row-query-${query.id}`}
                            >
                              <td className="p-3 text-sm text-foreground font-medium">{query.query}</td>
                              <td className="p-3 text-sm text-muted-foreground capitalize">{query.searchType}</td>
                              <td className="p-3 text-sm text-muted-foreground text-right">{query.quotesFound || 0}</td>
                              <td className="p-3 text-sm text-muted-foreground text-right">
                                {new Date(query.createdAt).toLocaleDateString()} {new Date(query.createdAt).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No query history yet</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {!quotesLoading && !hasQuotes && !isProcessing && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons text-muted-foreground" style={{ fontSize: '80px' }} aria-hidden="true">
              search
            </span>
            <h3 className="mt-6 text-xl font-semibold text-foreground">No quotes yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Enter a search query above to find and verify quotes from multiple sources. Results will appear here after processing.
            </p>
          </div>
        )}
      </main>

      <QuoteEditDialog
        quote={editingQuote}
        open={!!editingQuote}
        onOpenChange={(open) => !open && setEditingQuote(null)}
      />

      <CSVUploadDialog
        open={showCsvUpload}
        onOpenChange={setShowCsvUpload}
      />

      <ExportFiltersDialog
        open={showExportFilters}
        onOpenChange={setShowExportFilters}
      />
    </div>
  );
}
