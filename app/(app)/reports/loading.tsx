import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ListSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Skeleton className="h-8 w-40" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-56" />
            <Skeleton className="mt-1 h-3.5 w-72" />
          </CardHeader>
          <CardContent>
            <ListSkeleton items={4} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
