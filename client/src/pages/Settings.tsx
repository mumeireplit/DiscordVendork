import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  botToken: z.string().min(1, "Botトークンは必須です"),
  currencyName: z.string().min(1, "通貨名は必須です"),
  prefix: z.string().min(1, "コマンドプレフィックスは必須です"),
  guildId: z.string().min(1, "サーバーIDは必須です"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Get environment variables for bot token
  const botToken = import.meta.env.VITE_DISCORD_BOT_TOKEN || "";
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      botToken: botToken,
      currencyName: "コイン",
      prefix: "/vending",
      guildId: "",
    },
  });
  
  const onSubmit = async (data: FormValues) => {
    setIsSaving(true);
    
    try {
      // In a real app, you would save these settings to the server
      // For now, we'll just simulate that with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "設定を保存しました",
        description: "Botの設定が更新されました。",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "設定の保存中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <header className="bg-background border-b border-border p-4 mb-6 -mt-4 -mx-4 md:-mx-6 md:-mt-6 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-medium text-foreground">設定</h2>
        </div>
      </header>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Bot設定</CardTitle>
          <CardDescription>
            自動販売機Botの基本設定を行います。
          </CardDescription>
        </CardHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="botToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord Botトークン</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Bot token" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Discord Developer Portalで取得したBotトークン
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="guildId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord サーバーID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="サーバーID" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      自動販売機Botを使用するサーバーのID
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="currencyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>通貨名</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="通貨名" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      自動販売機で使用する通貨の名称
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>コマンドプレフィックス</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="コマンドプレフィックス" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      コマンドの先頭に付ける文字列（例: /vending）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            
            <CardFooter className="border-t p-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "保存中..." : "設定を保存"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
