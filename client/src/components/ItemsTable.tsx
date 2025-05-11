import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Item } from "@shared/schema";
import AddItemModal from "./AddItemModal";
import EditItemModal from "./EditItemModal";

interface ItemsTableProps {
  items: Item[];
  isLoading: boolean;
}

export default function ItemsTable({ items, isLoading }: ItemsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    try {
      await apiRequest('DELETE', `/api/items/${selectedItem.id}`);
      
      toast({
        title: "商品を削除しました",
        description: `${selectedItem.name} を削除しました。`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
    } catch (error) {
      toast({
        title: "エラー",
        description: "商品の削除中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const handleEdit = (item: Item) => {
    setSelectedItem(item);
    setEditItemDialogOpen(true);
  };

  const confirmDelete = (item: Item) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const getStockStatus = (stock: number) => {
    if (stock <= 0) {
      return { label: "在庫なし", variant: "destructive" as const };
    } else if (stock < 5) {
      return { label: "残り少", variant: "warning" as const };
    } else {
      return { label: "在庫あり", variant: "success" as const };
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-foreground">商品管理</h2>
        <Button onClick={() => setAddItemDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
          <span className="mr-1">+</span>
          <span>商品を追加</span>
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">読み込み中...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>商品名</TableHead>
                  <TableHead>価格</TableHead>
                  <TableHead className="w-[100px]">在庫</TableHead>
                  <TableHead className="w-[100px]">販売数</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      商品がありません
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const stockStatus = getStockStatus(item.stock);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-muted-foreground">
                          #{item.id.toString().padStart(3, '0')}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.price} コイン</TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                        </TableCell>
                        <TableCell>0</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => confirmDelete(item)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>商品を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedItem?.name} を削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddItemModal 
        open={addItemDialogOpen} 
        onOpenChange={setAddItemDialogOpen} 
      />

      {selectedItem && (
        <EditItemModal 
          open={editItemDialogOpen} 
          onOpenChange={setEditItemDialogOpen} 
          item={selectedItem}
        />
      )}
    </>
  );
}
