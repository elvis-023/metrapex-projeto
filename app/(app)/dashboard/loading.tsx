import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardGridSkeleton, TableRowsSkeleton } from "@/components/states/skeletons";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <CardGridSkeleton count={4} />
      <Card>
        <CardHeader>
          <div className="bg-muted h-5 w-40 animate-pulse rounded-md" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orçamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableRowsSkeleton rows={5} columns={4} />
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
