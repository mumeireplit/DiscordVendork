import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Package2, 
  DollarSign, 
  Receipt, 
  Settings as SettingsIcon,
  Zap,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();

  const navItems = [
    { name: "ダッシュボード", path: "/", icon: <LayoutDashboard className="mr-2 h-4 w-4" /> },
    { name: "商品管理", path: "/items", icon: <Package2 className="mr-2 h-4 w-4" /> },
    { name: "価格設定", path: "/pricing", icon: <DollarSign className="mr-2 h-4 w-4" /> },
    { name: "取引履歴", path: "/transactions", icon: <Receipt className="mr-2 h-4 w-4" /> },
    { name: "設定", path: "/settings", icon: <SettingsIcon className="mr-2 h-4 w-4" /> },
  ];

  return (
    <div className={cn("bg-secondary w-full md:w-64 md:min-h-screen p-4 flex flex-col", className)}>
      <div className="flex items-center space-x-2 mb-6">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h1 className="text-primary-foreground text-xl font-bold">自動販売機Bot</h1>
      </div>
      
      <ScrollArea className="flex-1 mb-4">
        <nav className="space-y-1 flex-grow">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant={location === item.path ? "default" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href={item.path}>
                {item.icon}
                <span>{item.name}</span>
              </Link>
            </Button>
          ))}
        </nav>
      </ScrollArea>
      
      <Button className="mb-4" variant="outline">
        <Zap className="mr-2 h-4 w-4" />
        サーバーに追加
      </Button>
      
      <div className="mt-auto pt-4 border-t border-border">
        <div className="flex items-center rounded-md p-2 bg-background">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div className="ml-2">
            <div className="text-sm text-foreground font-medium">VendingBot</div>
            <div className="text-xs text-muted-foreground">オンライン</div>
          </div>
        </div>
      </div>
    </div>
  );
}
