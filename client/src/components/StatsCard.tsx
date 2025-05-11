import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: {
    value: string | number;
    positive: boolean;
  };
  className?: string;
}

export function StatsCard({ title, value, icon, change, className }: StatsCardProps) {
  return (
    <Card className={cn("shadow-lg", className)}>
      <CardContent className="pt-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-muted-foreground text-sm">{title}</h3>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className="bg-primary bg-opacity-20 p-2 rounded-full">
            {icon}
          </div>
        </div>
        
        {change && (
          <p className={cn(
            "text-sm mt-2 flex items-center",
            change.positive ? "text-green-500" : "text-red-500"
          )}>
            {change.positive ? (
              <ArrowUp className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDown className="h-3 w-3 mr-1" />
            )}
            <span>{change.value}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
