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
import { Edit, Trash2, ShoppingCart, Plus, Minus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Item } from "@shared/schema";
import AddItemModal from "./AddItemModal";
import EditItemModal from "./EditItemModal";

interface CartItem {
  itemId: number;
  quantity: number;
  name: string;
  price: number;
}

interface ItemsTableProps {
  items: Item[];
  isLoading: boolean;
}

export default function ItemsTable({ items, isLoading }: ItemsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [purchaseDiscordId, setPurchaseDiscordId] = useState('');
  
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

  const handleAddToCart = (item: Item) => {
    // Check if item is already in cart
    const existingItem = cartItems.find(cartItem => cartItem.itemId === item.id);
    
    if (existingItem) {
      // Check if we have enough stock to add more
      if (existingItem.quantity >= item.stock) {
        toast({
          title: "在庫が足りません",
          description: `${item.name}の在庫が足りないため、これ以上追加できません。`,
          variant: "destructive",
        });
        return;
      }
      
      // Increment quantity
      setCartItems(prevItems => 
        prevItems.map(cartItem => 
          cartItem.itemId === item.id 
            ? { ...cartItem, quantity: cartItem.quantity + 1 } 
            : cartItem
        )
      );
    } else {
      // Add new item to cart
      setCartItems(prevItems => [
        ...prevItems, 
        { 
          itemId: item.id, 
          name: item.name, 
          price: item.price,
          quantity: 1 
        }
      ]);
    }
    
    toast({
      title: "カートに追加しました",
      description: `${item.name}をカートに追加しました。`,
    });
  };
  
  const handleRemoveFromCart = (itemId: number) => {
    // Find the item in the cart
    const cartItem = cartItems.find(item => item.itemId === itemId);
    
    if (!cartItem) return;
    
    if (cartItem.quantity > 1) {
      // Decrement quantity if more than 1
      setCartItems(prevItems => 
        prevItems.map(item => 
          item.itemId === itemId 
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        )
      );
    } else {
      // Remove item from cart if quantity is 1
      setCartItems(prevItems => prevItems.filter(item => item.itemId !== itemId));
    }
  };
  
  const handlePurchase = () => {
    if (cartItems.length === 0) {
      toast({
        title: "カートが空です",
        description: "購入する商品をカートに追加してください。",
        variant: "destructive",
      });
      return;
    }
    
    setPurchaseDialogOpen(true);
  };
  
  const completePurchase = async () => {
    if (!purchaseDiscordId || cartItems.length === 0) return;
    
    try {
      // Get the Discord user or create a new one
      const response = await apiRequest('POST', '/api/purchase', {
        discordId: purchaseDiscordId,
        items: cartItems.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity
        }))
      });
      
      toast({
        title: "購入完了",
        description: `${cartItems.length}種類の商品を購入しました。`,
      });
      
      // Clear cart after successful purchase
      setCartItems([]);
      setPurchaseDiscordId('');
      setPurchaseDialogOpen(false);
      
      // Refresh items to update stock
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: "購入エラー",
        description: "購入処理中にエラーが発生しました。Discord IDが正しいか確認してください。",
        variant: "destructive",
      });
    }
  };
  
  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };
  
  const getStockStatus = (stock: number) => {
    if (stock <= 0) {
      return { label: "在庫なし", variant: "destructive" as const };
    } else if (stock < 5) {
      return { label: "残り少", variant: "outline" as const }; // Changed from warning to outline
    } else {
      return { label: "在庫あり", variant: "default" as const }; // Changed from success to default
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-foreground">商品管理</h2>
        <div className="flex space-x-2">
          {cartItems.length > 0 && (
            <Button 
              onClick={handlePurchase} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              <span>購入する ({cartItems.reduce((sum, item) => sum + item.quantity, 0)})</span>
            </Button>
          )}
          <Button onClick={() => setAddItemDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
            <span className="mr-1">+</span>
            <span>商品を追加</span>
          </Button>
        </div>
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
                        <TableCell className="font-medium">
                          {item.name}
                          {(item.content || (item.contentOptions && item.contentOptions.length > 0)) && (
                            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              DM送信
                            </Badge>
                          )}
                        </TableCell>
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
                              onClick={() => handleAddToCart(item)}
                              disabled={item.stock <= 0}
                              className="text-green-600"
                              title="カートに追加"
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                            {(item.content || (item.contentOptions && item.contentOptions.length > 0)) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setPreviewDialogOpen(true);
                                }}
                                className="text-blue-600"
                                title="内容をプレビュー"
                              >
                                <span className="text-xs font-bold">👁️</span>
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEdit(item)}
                              title="編集"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => confirmDelete(item)}
                              className="text-destructive"
                              title="削除"
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
      
      {/* 購入ダイアログ */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>購入を確定する</DialogTitle>
            <DialogDescription>
              以下の商品をDiscordユーザーのアカウントで購入します。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="discord-id" className="text-sm font-medium">
                Discord ID
              </label>
              <input
                id="discord-id"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="例: 123456789012345678"
                value={purchaseDiscordId}
                onChange={(e) => setPurchaseDiscordId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                DiscordのユーザーIDを入力してください。プロフィールから確認できます。
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">カート内の商品</p>
              <div className="rounded-md border">
                {cartItems.map((item) => (
                  <div key={item.itemId} className="flex items-center justify-between border-b p-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.price} コイン × {item.quantity}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleRemoveFromCart(item.itemId)}
                        disabled={item.quantity <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => {
                          const foundItem = items.find(i => i.id === item.itemId);
                          if (foundItem) {
                            handleAddToCart(foundItem);
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-medium">合計</span>
                <span className="text-sm font-bold">{getTotalPrice()} コイン</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={completePurchase}
              disabled={!purchaseDiscordId || cartItems.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              購入を確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
