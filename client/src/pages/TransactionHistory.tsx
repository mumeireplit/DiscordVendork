import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Transaction, Item, DiscordUser } from "@shared/schema";

export default function TransactionHistory() {
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });
  
  const { data: items } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });
  
  const { data: users } = useQuery<DiscordUser[]>({
    queryKey: ['/api/discord-users'],
  });
  
  const isLoading = isLoadingTransactions || !items || !users;
  
  // Helper function to get item name by ID
  const getItemName = (itemId: number) => {
    if (!items) return "不明なアイテム";
    const item = items.find(i => i.id === itemId);
    return item ? item.name : "不明なアイテム";
  };
  
  // Helper function to get user name by ID
  const getUserName = (userId: number) => {
    if (!users) return "不明なユーザー";
    const user = users.find(u => u.id === userId);
    return user ? user.username : "不明なユーザー";
  };
  
  // Format date
  const formatDate = (date: Date | string) => {
    return format(new Date(date), "yyyy/MM/dd HH:mm", { locale: ja });
  };

  return (
    <div className="p-4 md:p-6">
      <header className="bg-background border-b border-border p-4 mb-6 -mt-4 -mx-4 md:-mx-6 md:-mt-6 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-medium text-foreground">取引履歴</h2>
        </div>
      </header>
      
      <Card>
        <CardHeader>
          <CardTitle>取引履歴</CardTitle>
          <CardDescription>
            自動販売機での全ての取引履歴を表示します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">読み込み中...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>日時</TableHead>
                  <TableHead>ユーザー</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions && transactions.length > 0 ? (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-mono text-muted-foreground">
                        #{transaction.id.toString().padStart(3, '0')}
                      </TableCell>
                      <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                      <TableCell>{getUserName(transaction.discordUserId)}</TableCell>
                      <TableCell>{getItemName(transaction.itemId)}</TableCell>
                      <TableCell>{transaction.quantity}</TableCell>
                      <TableCell className="font-medium">{transaction.totalPrice} コイン</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6">
                      取引履歴がありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
