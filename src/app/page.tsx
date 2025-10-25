import CoinCaptcha from "@/components/coin-captcha";
import { IndianRupee } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-2 mb-8">
        <IndianRupee className="w-16 h-16 text-primary" />
        <h1 className="text-4xl font-headline font-bold text-center text-foreground">
          Coin Captcha
        </h1>
        <p className="text-muted-foreground text-center">Solve captchas to earn rupees!</p>
      </div>
      <CoinCaptcha />
    </main>
  );
}
