"use client";

import { useUser, useDoc, useCollection, useFirestore } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, type Firestore } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const OraCoin = ({ className }: { className?: string }) => (
    <div className={`w-8 h-8 rounded-full bg-accent flex items-center justify-center ${className}`}>
        <span className="text-lg font-bold text-accent-foreground">O</span>
    </div>
);

type Transaction = {
  id: string;
  type: "captcha" | "ad" | "send" | "receive";
  amount: number;
  timestamp: {
    toDate: () => Date;
  };
  from?: string;
  to?: string;
};

function SendCoinForm({ currentUser, currentBalance, onSent }: { currentUser: any; currentBalance: number, onSent: () => void }) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [isSending, startSending] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    const sendAmount = parseInt(amount, 10);

    if (!recipientEmail || !sendAmount || sendAmount <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid email and a positive amount.",
        variant: "destructive",
      });
      return;
    }

    if (sendAmount > currentBalance) {
      toast({
        title: "Insufficient Funds",
        description: "You do not have enough ORA coins to make this transfer.",
        variant: "destructive",
      });
      return;
    }

    if (recipientEmail === currentUser.email) {
      toast({
        title: "Invalid Recipient",
        description: "You cannot send coins to yourself.",
        variant: "destructive",
      });
      return;
    }

    startSending(async () => {
       try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where("email", "==", recipientEmail), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          toast({ title: "Error", description: "Recipient not found.", variant: "destructive" });
          return;
        }
        
        const recipientDoc = querySnapshot.docs[0];
        const recipientUid = recipientDoc.id;
        const senderUid = currentUser.uid;

        await runTransaction(firestore, async (transaction) => {
            const senderRef = doc(firestore, `users/${senderUid}`);
            const recipientRef = doc(firestore, `users/${recipientUid}`);

            const senderDoc = await transaction.get(senderRef);

            if (!senderDoc.exists()) {
                throw new Error("Your user document does not exist.");
            }

            const senderBalance = senderDoc.data()?.coinBalance || 0;
            if (senderBalance < sendAmount) {
                throw new Error('Insufficient funds.');
            }
            
            // Perform the updates
            transaction.update(senderRef, { coinBalance: senderBalance - sendAmount });
            transaction.update(recipientRef, { coinBalance: recipientDoc.data().coinBalance + sendAmount });
            
            const senderTransactionRef = doc(collection(senderRef, 'transactions'));
            transaction.set(senderTransactionRef, {
                type: 'send',
                amount: sendAmount,
                to: recipientEmail,
                timestamp: serverTimestamp(),
            });

            const recipientTransactionRef = doc(collection(recipientRef, 'transactions'));
            transaction.set(recipientTransactionRef, {
                type: 'receive',
                amount: sendAmount,
                from: currentUser.email,
                timestamp: serverTimestamp(),
            });
        });

        toast({
          title: "Success",
          description: `Successfully sent ${sendAmount} ORA to ${recipientEmail}.`,
        });
        onSent();
      } catch (error: any) {
        console.error('Transaction failed: ', error);
        // This is a generic error handler. For permission errors, the specific handlers in the data hooks will still trigger.
        if (error.code !== 'permission-denied') {
            toast({
              title: "Error",
              description: error.message || 'An unexpected error occurred during the transaction.',
              variant: "destructive",
            });
        }
      }
    });
  };

  return (
    <form onSubmit={handleSend} className="grid gap-4 mt-4">
      <Input
        type="email"
        placeholder="Recipient's email"
        required
        value={recipientEmail}
        onChange={(e) => setRecipientEmail(e.target.value)}
        disabled={isSending}
      />
      <Input
        type="number"
        placeholder="Amount"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={isSending}
        min="1"
        max={currentBalance}
      />
      <Button type="submit" className="w-full" disabled={isSending}>
        {isSending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Send Coins
      </Button>
    </form>
  );
}


export function Wallet() {
  const { user } = useUser();
  const [isSendDialogOpen, setSendDialogOpen] = useState(false);

  const userDocPath = useMemo(() => (user ? `users/${user.uid}` : null), [user]);
  const transactionsPath = useMemo(() => (user ? `users/${user.uid}/transactions` : null), [user]);

  const { data: userProfile, loading: userProfileLoading, refetch: refetchUserProfile } = useDoc<any>(userDocPath);
  const { data: transactions, loading: transactionsLoading, refetch: refetchTransactions } = useCollection<Transaction>(
    transactionsPath,
    { orderBy: ["timestamp", "desc"], limit: 50 }
  );

  const handleCoinSent = () => {
    setSendDialogOpen(false);
    refetchUserProfile();
    refetchTransactions();
  }

  const getTransactionDetails = (tx: Transaction) => {
    switch (tx.type) {
        case 'captcha':
        case 'ad':
            return {
                badgeVariant: tx.type === 'ad' ? 'secondary' : 'default' as const,
                amountText: `+${tx.amount}`,
                date: tx.timestamp ? format(tx.timestamp.toDate(), "PPpp") : '...',
            };
        case 'send':
            return {
                badgeVariant: 'destructive' as const,
                amountText: `-${tx.amount}`,
                date: tx.timestamp ? format(tx.timestamp.toDate(), "PPpp") : '...',
            };
        case 'receive':
            return {
                badgeVariant: 'outline' as const,
                amountText: `+${tx.amount}`,
                date: tx.timestamp ? format(tx.timestamp.toDate(), "PPpp") : '...',
            };
        default:
            return {
                badgeVariant: 'default' as const,
                amountText: `${tx.amount}`,
                date: tx.timestamp ? format(tx.timestamp.toDate(), "PPpp") : '...',
            };
    }
  }


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
        <CardContent>
          <Dialog open={isSendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
               <Button className="w-full">
                <Send className="mr-2 h-4 w-4" /> Send ORA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send ORA Coins</DialogTitle>
                <DialogDescription>
                  Enter the recipient's email and the amount to send.
                </DialogDescription>
              </DialogHeader>
              {user && <SendCoinForm currentUser={user} currentBalance={userProfile?.coinBalance || 0} onSent={handleCoinSent} />}
            </DialogContent>
          </Dialog>
        </CardContent>
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
                {transactions?.map((tx) => {
                  const details = getTransactionDetails(tx);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant={details.badgeVariant}>{tx.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{details.amountText}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {details.date}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
