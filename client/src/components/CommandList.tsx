import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface Command {
  command: string;
  description: string;
}

interface CommandListProps {
  title: string;
  description: string;
  commands: Command[];
}

export function CommandList({ title, description, commands }: CommandListProps) {
  const { toast } = useToast();

  const copyToClipboard = (command: string) => {
    navigator.clipboard.writeText(command);
    toast({
      title: "コピーしました",
      description: `${command} をクリップボードにコピーしました。`,
      duration: 2000,
    });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {commands.map((cmd, index) => (
            <div key={index} className="p-4 hover:bg-secondary/50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-foreground font-mono bg-secondary px-2 py-1 rounded text-sm inline-block">
                    {cmd.command}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{cmd.description}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(cmd.command)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
