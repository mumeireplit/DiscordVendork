import { useQuery } from "@tanstack/react-query";
import ItemsTable from "@/components/ItemsTable";
import { Item } from "@shared/schema";

export default function ItemManagement() {
  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  return (
    <div className="p-4 md:p-6">
      <header className="bg-background border-b border-border p-4 mb-6 -mt-4 -mx-4 md:-mx-6 md:-mt-6 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-medium text-foreground">商品管理</h2>
        </div>
      </header>
      
      <ItemsTable 
        items={items || []} 
        isLoading={isLoading} 
      />
    </div>
  );
}
