import { Card, CardContent } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Item } from "@shared/schema";

export function DiscordPreview() {
  const { data: items } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  // Filter for active items with stock
  const availableItems = items?.filter(item => item.isActive && item.stock > 0) || [];

  return (
    <Card className="shadow-lg p-4">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-medium text-foreground">Discordプレビュー</h2>
        <div className="text-sm text-muted-foreground">自動販売機がDiscordでどのように表示されるか</div>
      </div>
      
      <CardContent className="p-0">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
            <Bot className="h-5 w-5" />
          </div>
          
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <span className="font-medium text-foreground">VendingBot</span>
              <span className="text-xs text-muted-foreground ml-2">今日 13:45</span>
            </div>
            
            <div className="mt-2 discord-embed bg-card p-4 rounded-md shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-foreground font-medium">自動販売機</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    以下の商品が販売中です！購入するには `/vending_buy [商品ID]` を使用してください。管理者は `/vending_addcoins` でユーザーにコインを追加できます。
                  </p>
                </div>
                <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center text-white">
                  <Bot className="h-6 w-6" />
                </div>
              </div>
              
              <div className="mt-4 grid gap-2">
                {availableItems.length > 0 ? (
                  availableItems.slice(0, 3).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-secondary rounded-md">
                      <div className="flex items-center">
                        <div className="text-primary font-medium mr-2">
                          #{item.id.toString().padStart(3, '0')}
                        </div>
                        <div className="text-foreground">{item.name}</div>
                      </div>
                      <div className="text-green-500 font-medium">{item.price} コイン</div>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-muted-foreground text-center">
                    現在販売中の商品はありません
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex justify-between items-center text-sm">
                <div className="text-muted-foreground">残高: <span className="text-foreground font-medium">1,250 コイン</span></div>
                <div className="text-primary cursor-pointer">ヘルプを表示</div>
              </div>
            </div>
            
            <div className="mt-4 flex">
              <div className="flex-1">
                <div className="bg-secondary rounded-md flex items-center px-3 py-2">
                  <span className="text-muted-foreground mr-2">+</span>
                  <Input 
                    type="text" 
                    placeholder="/vending_buy" 
                    className="bg-transparent border-0 outline-none text-foreground flex-1" 
                    readOnly 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
