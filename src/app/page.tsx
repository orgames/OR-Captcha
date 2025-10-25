import CoinCaptcha from "@/components/coin-captcha";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-2 mb-8">
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
