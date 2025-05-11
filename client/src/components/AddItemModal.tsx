import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertItemSchema } from "@shared/schema";

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
});

type FormValues = z.infer<typeof formSchema>;

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddItemModal({ open, onOpenChange }: AddItemModalProps) {
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      stock: 0,
      isActive: true,
      discordRoleId: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    
    try {
      // Clean up empty role ID
      const submitData = {
        ...data,
        discordRoleId: data.discordRoleId.trim() || null,
      };
      
      await apiRequest("POST", "/api/items", submitData);
      
      toast({
        title: "商品を追加しました",
        description: `${data.name} を追加しました。`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add item:", error);
      toast({
        title: "エラー",
        description: "商品の追加に失敗しました。",
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
          <DialogTitle>商品を追加</DialogTitle>
          <DialogDescription>
            自動販売機に新しい商品を追加します。
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
                {isPending ? "追加中..." : "追加"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
