import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import { CommandList } from "@/components/CommandList";
import { DiscordPreview } from "@/components/DiscordPreview";
import { ShoppingBag, DollarSign, Package, Users } from "lucide-react";

interface Stats {
  totalSales: number;
  totalRevenue: number;
  totalStock: number;
  lowStockItems: number;
  userCount: number;
  newUsers: number;
  salesGrowth: number;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['/api/stats'],
  });

  const basicCommands = [
    {
      command: "/vending_show",
      description: "販売中の商品リストを表示します",
    },
    {
      command: "/vending_buy [item_id] [quantity]",
      description: "指定した商品を購入します",
    },
    {
      command: "/vending_balance",
      description: "残高を確認します",
    },
  ];

  const adminCommands = [
    {
      command: "/vending_add [name] [price] [description]",
      description: "新しい商品を追加します",
    },
    {
      command: "/vending_remove [item_id]",
      description: "商品を削除します",
    },
    {
      command: "/vending_price [item_id] [new_price]",
      description: "商品の価格を変更します",
    },
    {
      command: "/vending_stock [item_id] [quantity]",
      description: "商品の在庫数を設定します",
    },
    {
      command: "/vending_addcoins [user] [amount]",
      description: "特定のユーザーにコインを追加します",
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <header className="bg-background border-b border-border p-4 mb-6 -mt-4 -mx-4 md:-mx-6 md:-mt-6 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-medium text-foreground">ダッシュボード</h2>
          <div className="flex items-center space-x-4">
            <button className="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="総販売数"
          value={isLoading ? "..." : stats?.totalSales || 0}
          icon={<ShoppingBag className="h-5 w-5 text-primary" />}
          change={stats?.salesGrowth ? {
            value: `${stats.salesGrowth}% 先週より`,
            positive: stats.salesGrowth > 0
          } : undefined}
        />
        
        <StatsCard
          title="売上高"
          value={isLoading ? "..." : stats?.totalRevenue || 0}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          change={stats?.salesGrowth ? {
            value: `${Math.round(stats.salesGrowth/2)}% 先週より`,
            positive: stats.salesGrowth > 0
          } : undefined}
        />
        
        <StatsCard
          title="在庫数"
          value={isLoading ? "..." : stats?.totalStock || 0}
          icon={<Package className="h-5 w-5 text-yellow-500" />}
          change={stats?.lowStockItems ? {
            value: `${stats.lowStockItems} アイテム残り少`,
            positive: false
          } : undefined}
        />
        
        <StatsCard
          title="利用者数"
          value={isLoading ? "..." : stats?.userCount || 0}
          icon={<Users className="h-5 w-5 text-primary" />}
          change={stats?.newUsers ? {
            value: `${stats.newUsers}人 新規利用者`,
            positive: true
          } : undefined}
        />
      </section>

      <section className="mb-8">
        <CommandList
          title="コマンド一覧"
          description="自動販売機の基本操作に使用するコマンド"
          commands={basicCommands}
        />
      </section>

      <section className="mb-8">
        <CommandList
          title="管理者コマンド"
          description="自動販売機を管理するためのコマンド（管理者権限が必要）"
          commands={adminCommands}
        />
      </section>

      <section>
        <DiscordPreview />
      </section>
    </div>
  );
}
