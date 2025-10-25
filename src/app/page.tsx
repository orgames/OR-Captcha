"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase/auth/use-user";
import CoinCaptcha from "@/components/coin-captcha";
import { UserNav } from "@/components/auth/user-nav";

export default function Home() {
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
        <div></div>
        <UserNav />
      </header>
      <div className="flex flex-col items-center gap-2 my-8">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <span className="text-4xl font-bold text-primary-foreground">O</span>
        </div>
        <h1 className="text-4xl font-headline font-bold text-center text-foreground">
          ORA Captcha
        </h1>
        <p className="text-muted-foreground text-center">Solve captchas to earn ORA coins!</p>
      </div>
      <CoinCaptcha />
    </main>
  );
}
