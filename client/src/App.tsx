import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

import Dashboard from "@/pages/Dashboard";
import ItemManagement from "@/pages/ItemManagement";
import PricingSettings from "@/pages/PricingSettings";
import TransactionHistory from "@/pages/TransactionHistory";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

import { Sidebar } from "@/components/ui/sidebar";

function Router() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/items" component={ItemManagement} />
          <Route path="/pricing" component={PricingSettings} />
          <Route path="/transactions" component={TransactionHistory} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vending-ui-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
