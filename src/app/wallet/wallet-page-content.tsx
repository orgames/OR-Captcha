
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase/auth/use-user";
import { UserNav } from "@/components/auth/user-nav";
import { Wallet } from "@/components/wallet";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function WalletPageContent() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-start bg-background p-4">
      <header className="w-full flex justify-between items-center p-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <UserNav />
      </header>
      <div className="flex flex-col items-center gap-2 my-8">
        <h1 className="text-4xl font-headline font-bold text-center text-foreground">
          My Wallet
        </h1>
        <p className="text-muted-foreground text-center">View your balance and transaction history.</p>
      </div>
      <Wallet />
    </main>
  );
}
