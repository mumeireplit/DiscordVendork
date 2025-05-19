import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertItemSchema, Item } from "@shared/schema";
import { PlusCircle, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// Extended schema with validation
const formSchema = insertItemSchema.extend({
  name: z.string().min(1, "商品名は必須項目です"),
  description: z.string().min(1, "説明は必須項目です"),
  price: z.number().min(0, "価格は0以上の値を指定してください"),
  stock: z.number().min(0, "在庫数は0以上の値を指定してください"),
  content: z.string().optional(),
  options: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
}

export default function EditItemModal({ open, onOpenChange, item }: EditItemModalProps) {
  const [isPending, setIsPending] = useState(false);
  const [optionInput, setOptionInput] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item.name,
      description: item.description,
      price: item.price,
      stock: item.stock,
      isActive: item.isActive,
      infiniteStock: item.infiniteStock || false,
      discordRoleId: item.discordRoleId || "",
      content: item.content || "",
      options: item.options || [],
    },
  });
  
  // 選択肢を追加する関数
  const addOption = () => {
    if (!optionInput.trim()) return;
    
    const currentOptions = form.getValues("options") || [];
    form.setValue("options", [...currentOptions, optionInput.trim()]);
    setOptionInput("");
  };
  
  // 選択肢を削除する関数
  const removeOption = (index: number) => {
    const currentOptions = form.getValues("options") || [];
    form.setValue(
      "options",
      currentOptions.filter((_, i) => i !== index)
    );
  };

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    
    try {
      // Clean up empty role ID
      const submitData = {
        ...data,
        discordRoleId: data.discordRoleId.trim() || null,
      };
      
      await apiRequest("PATCH", `/api/items/${item.id}`, submitData);
      
      toast({
        title: "商品を更新しました",
        description: `${data.name} を更新しました。`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update item:", error);
      toast({
        title: "エラー",
        description: "商品の更新に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>商品を編集</DialogTitle>
          <DialogDescription>
            #{item.id.toString().padStart(3, '0')} {item.name} の情報を編集します。
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商品名</FormLabel>
                  <FormControl>
                    <Input placeholder="商品名を入力" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>価格 (コイン)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="価格を入力" 
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>説明</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="商品の説明" 
                      className="resize-none h-20" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>在庫数</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="在庫数を入力" 
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>コンテンツ (オプション)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="購入者に送信するURL/コンテンツを入力（DMで送信されます）" 
                      className="resize-none h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    購入者にDMで送信される内容です。URLやアクセスコードなどを入力してください。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="discordRoleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discord ロールID (オプション)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="購入時に付与するロールIDを入力" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* 選択肢の入力部分 */}
            <div className="space-y-2">
              <FormLabel>選択肢 (オプション)</FormLabel>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="選択肢を入力（例：赤、XL、タイプA）"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addOption}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
              <FormDescription>
                Enterキーまたは+ボタンで選択肢を追加できます。購入時に表示される選択肢です。
              </FormDescription>
              
              {/* 選択肢のリスト */}
              {form.watch("options")?.length > 0 && (
                <div className="mt-2 space-y-2">
                  {form.watch("options").map((option, index) => (
                    <div key={index} className="flex items-center justify-between rounded border p-2">
                      <span>{option}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>アクティブ</FormLabel>
                    <FormDescription className="text-xs">
                      この商品を販売中としてリストに表示します
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
