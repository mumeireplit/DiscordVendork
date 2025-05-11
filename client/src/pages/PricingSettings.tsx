import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Item } from "@shared/schema";

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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckIcon, Pencil } from "lucide-react";

export default function PricingSettings() {
  const { data: items, isLoading, refetch } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();
  
  const handleEdit = (item: Item) => {
    setEditingId(item.id);
    setEditPrice(item.price);
  };
  
  const handleSave = async (itemId: number) => {
    setIsSaving(true);
    
    try {
      await apiRequest('PATCH', `/api/items/${itemId}`, { price: editPrice });
      
      toast({
        title: "価格を更新しました",
        description: "商品の価格が更新されました。",
      });
      
      refetch();
      setEditingId(null);
    } catch (error) {
      toast({
        title: "エラー",
        description: "価格の更新中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="p-4 md:p-6">
      <header className="bg-background border-b border-border p-4 mb-6 -mt-4 -mx-4 md:-mx-6 md:-mt-6 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-medium text-foreground">価格設定</h2>
        </div>
      </header>
      
      <Card>
        <CardHeader>
          <CardTitle>商品価格設定</CardTitle>
          <CardDescription>
            各商品の価格を変更できます。「編集」ボタンをクリックして新しい価格を設定してください。
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
                  <TableHead>商品名</TableHead>
                  <TableHead>現在の価格</TableHead>
                  <TableHead className="w-[250px]">新しい価格</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items && items.length > 0 ? (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-muted-foreground">
                        #{item.id.toString().padStart(3, '0')}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.price} コイン</TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <Input
                            type="number"
                            min={0}
                            value={editPrice}
                            onChange={(e) => setEditPrice(parseInt(e.target.value) || 0)}
                            className="w-32"
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleSave(item.id)}
                              disabled={isSaving}
                            >
                              <CheckIcon className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={handleCancel}
                              disabled={isSaving}
                            >
                              <span className="text-red-500">×</span>
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      商品がありません
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
