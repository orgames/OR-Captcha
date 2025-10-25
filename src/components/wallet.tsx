"use client";

import { useUser, useDoc, useCollection } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const OraCoin = ({ className }: { className?: string }) => (
    <div className={`w-8 h-8 rounded-full bg-accent flex items-center justify-center ${className}`}>
        <span className="text-lg font-bold text-accent-foreground">O</span>
    </div>
);

type Transaction = {
  id: string;
  type: "captcha" | "ad";
  amount: number;
  timestamp: {
    toDate: () => Date;
  };
};

export function Wallet() {
  const { user } = useUser();
  const { data: userProfile, loading: userProfileLoading } = useDoc<any>(`users/${user?.uid}`);
  const { data: transactions, loading: transactionsLoading } = useCollection<Transaction>(
    `users/${user?.uid}/transactions`,
    { orderBy: ["timestamp", "desc"], limit: 50 }
  );

  return (
    <div className="w-full max-w-md space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-headline">Your Balance</CardTitle>
              <CardDescription>Total ORA coins earned</CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-accent/30 text-accent-foreground p-2 rounded-lg">
              <OraCoin className="w-8 h-8" />
              <span className="text-3xl font-bold font-headline">
                {userProfileLoading ? '...' : userProfile?.coinBalance || 0}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Transaction History</CardTitle>
          <CardDescription>Your last 50 transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsLoading && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      Loading transactions...
                    </TableCell>
                  </TableRow>
                )}
                {!transactionsLoading && transactions?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                )}
                {transactions?.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant={tx.type === 'ad' ? 'secondary' : 'default'}>{tx.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">+{tx.amount}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {tx.timestamp ? format(tx.timestamp.toDate(), "PPpp") : '...'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
