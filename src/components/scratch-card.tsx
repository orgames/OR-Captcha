
"use client";

import { useState, useRef, useEffect, useTransition, useMemo } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clapperboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, collection, runTransaction, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";

const scratchPrizes = [1, 5, 10, 2, 25, 0, 5, 2, 50, 0];
const SCRATCH_RADIUS = 40;
const DAILY_SCRATCH_LIMIT = 20;
const COINS_PER_AD = 0.5;

const OraCoin = ({ className }: { className?: string }) => (
  <div className={`w-8 h-8 rounded-full bg-accent flex items-center justify-center ${className}`}>
    <span className="text-lg font-bold text-accent-foreground">O</span>
  </div>
);

const OraCoinReward = ({ className }: { className?: string }) => (
  <div className={`w-12 h-12 rounded-full bg-accent flex items-center justify-center ${className}`}>
    <span className="text-2xl font-bold text-accent-foreground">O</span>
  </div>
);

export default function ScratchCard() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, loading: userProfileLoading, refetch } = useDoc<any>(userDocRef?.path);

  const [isGettingCard, startGettingCard] = useTransition();
  const [isClaiming, startClaiming] = useTransition();
  const [isAdRunning, startAd] = useTransition();
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [prizeAmount, setPrizeAmount] = useState<number | null>(null);
  const [isCardScratched, setIsCardScratched] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const scratchesToday = userProfile?.scratchesToday || 0;
  const canScratch = scratchesToday < DAILY_SCRATCH_LIMIT;

  const setupCanvas = (prize: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'hsl(var(--card))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 48px "PT Sans"';
    ctx.fillStyle = 'hsl(var(--accent))';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prize > 0 ? `${prize} ORA` : 'Better Luck!', canvas.width / 2, canvas.height / 2);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = '16px "PT Sans"';
    ctx.fillStyle = 'hsl(var(--muted-foreground))';
    ctx.fillText('Scratch to reveal your prize!', canvas.width / 2, canvas.height / 2);

    setIsCardScratched(false);
  };
  
  const handleGetNewCard = () => {
    if (isGettingCard || !user || !firestore || !canScratch || !isCardScratched || isAdRunning) {
      if(!canScratch) {
        toast({
          title: "Daily limit reached",
          description: `You have used all your ${DAILY_SCRATCH_LIMIT} scratches for today.`,
          variant: "destructive"
        })
      }
      return;
    }

    startGettingCard(async () => {
      const userRef = doc(firestore, 'users', user.uid);
      const newPrize = scratchPrizes[Math.floor(Math.random() * scratchPrizes.length)];
      setPrizeAmount(newPrize);
      const today = format(new Date(), 'yyyy-MM-dd');

      try {
        await runTransaction(firestore, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) {
            throw new Error("User document does not exist.");
          }
          
          const userData = userDoc.data();
          const currentScratches = userData.lastScratchDate === today ? userData.scratchesToday : 0;
          
          if (currentScratches >= DAILY_SCRATCH_LIMIT) {
              throw new Error("Daily scratch limit reached.");
          }
          
          const newBalance = (userData.coinBalance || 0) + newPrize;
          
          const updates: any = {
            coinBalance: newBalance,
            scratchesToday: currentScratches + 1,
            lastScratchDate: today
          };

          transaction.update(userRef, updates);

          if (newPrize > 0) {
              const transactionRef = doc(collection(userRef, 'transactions'));
              transaction.set(transactionRef, {
                  type: 'scratch' as const,
                  amount: newPrize,
                  timestamp: serverTimestamp(),
              });
          }
        });

        setupCanvas(newPrize);
        if (newPrize > 0) {
            setAnimationTrigger(Date.now());
             toast({
                title: "You Won!",
                description: `You've won ${newPrize} ORA coins.`,
            });
        } else {
             toast({
                title: "Better Luck Next Time!",
                description: "You didn't win any coins this time. Try again!",
            });
        }

      } catch (error: any) {
        console.error("Transaction failed: ", error);
        toast({
          title: error.message || "An unexpected error occurred",
          description: "Could not get a new scratch card. Please try again.",
          variant: "destructive",
        });
        setIsCardScratched(true);
        setPrizeAmount(null);
      } finally {
        refetch();
      }
    });
  };
  
  const handleWatchAd = () => {
    if (isGettingCard || isClaiming || !user || !firestore || isAdRunning) return;
    startAd(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const userRef = doc(firestore, 'users', user.uid);
        const newPrize = COINS_PER_AD;

        try {
            await runTransaction(firestore, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User document does not exist.");
                
                const userData = userDoc.data();
                const newBalance = (userData.coinBalance || 0) + newPrize;
                
                transaction.update(userRef, { coinBalance: newBalance });

                const transactionRef = doc(collection(userRef, 'transactions'));
                transaction.set(transactionRef, {
                    type: 'ad' as const,
                    amount: newPrize,
                    timestamp: serverTimestamp(),
                });
            });

            setAnimationTrigger(Date.now());
            toast({
                title: "You Won!",
                description: `You've won ${newPrize} ORA coins.`,
            });
        } catch (error: any) {
            console.error("Watch ad transaction failed: ", error);
            toast({
                title: error.message || "An unexpected error occurred",
                description: "Could not record your reward. Please try again.",
                variant: "destructive"
            });
        } finally {
            refetch();
        }
    });
  };

  const handleClaimScratch = () => {
     if (!user || !firestore || canScratch) return;

     startClaiming(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate watching an ad
        const userRef = doc(firestore, 'users', user.uid);
        try {
            await runTransaction(firestore, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User not found");

                const currentScratches = userDoc.data().scratchesToday || 0;
                if (currentScratches < DAILY_SCRATCH_LIMIT) {
                    throw new Error("You can still scratch!");
                }

                transaction.update(userRef, { scratchesToday: currentScratches - 1 });

                const transactionRef = doc(collection(userRef, 'transactions'));
                 transaction.set(transactionRef, {
                    type: 'ad' as const,
                    amount: 0, // No coin reward, just a spin
                    timestamp: serverTimestamp(),
                });
            });
            toast({
                title: "Scratch Claimed!",
                description: "You have received one extra scratch.",
            });
            refetch();
        } catch (error: any) {
            toast({
                title: "Claim Failed",
                description: error.message || "Could not claim a scratch. Please try again.",
                variant: "destructive"
            });
        }
     });
  }
  
  const getScratchPercentage = () => {
    const canvas = canvasRef.current;
     if (!canvas) return 0;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const totalPixels = pixels.width * pixels.height;
    let transparentPixels = 0;

    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i + 3] === 0) {
        transparentPixels++;
      }
    }
    return (transparentPixels / totalPixels) * 100;
  }

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || isCardScratched || isGettingCard) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, SCRATCH_RADIUS, 0, 2 * Math.PI);
    ctx.fill();

    const percentage = getScratchPercentage();
    if (percentage > 50) {
        revealCard();
    }
  };
  
  const revealCard = () => {
    if (isCardScratched) return;
    setIsCardScratched(true);
    
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'hsl(var(--card))';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = 'bold 48px "PT Sans"';
            ctx.fillStyle = 'hsl(var(--accent))';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const currentPrize = prizeAmount ?? 0;
            ctx.fillText(currentPrize > 0 ? `${currentPrize} ORA` : 'Better Luck!', canvas.width / 2, canvas.height / 2);
        }
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isCardScratched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.onmousemove = (moveEvent) => {
      const x = moveEvent.clientX - rect.left;
      const y = moveEvent.clientY - rect.top;
      scratch(x, y);
    };
    canvas.onmouseup = () => {
      canvas.onmousemove = null;
      canvas.onmouseup = null;
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isCardScratched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.ontouchmove = (moveEvent) => {
      if (moveEvent.touches.length > 0) {
        const touch = moveEvent.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        scratch(x, y);
      }
    };
    canvas.ontouchend = () => {
      canvas.ontouchmove = null;
      canvas.ontouchend = null;
    };
  };
  
  const remainingScratches = DAILY_SCRATCH_LIMIT - scratchesToday;

  return (
    <Card className="w-full max-w-md shadow-lg relative overflow-visible">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="font-headline">Your Balance</CardTitle>
            <CardDescription>
                {userProfileLoading ? '...' : `${remainingScratches < 0 ? 0 : remainingScratches} scratches left today`}
            </CardDescription>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 bg-accent/30 text-accent-foreground p-2 rounded-lg">
              <OraCoin className="w-8 h-8" />
              <span className="text-3xl font-bold font-headline">
                {userProfileLoading ? "..." : userProfile?.coinBalance || 0}
              </span>
            </div>
            {animationTrigger > 0 && (
              <div
                key={animationTrigger}
                className="absolute inset-0 flex items-center justify-center"
              >
                <OraCoinReward className="animate-coin-reward" />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center space-y-4">
        <canvas
          ref={canvasRef}
          width="350"
          height="150"
          className={`rounded-md border-2 border-dashed border-muted-foreground ${!isCardScratched ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          variant="default"
          className="w-full"
          onClick={handleGetNewCard}
          disabled={isGettingCard || !isCardScratched || !canScratch}
        >
          {isGettingCard ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Get New Card
        </Button>
         <Button
          variant="outline"
          className="w-full border-accent text-accent-foreground hover:bg-accent/20 hover:text-accent-foreground"
          onClick={handleWatchAd}
          disabled={isGettingCard || isClaiming || isAdRunning}
        >
          {isAdRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clapperboard className="mr-2 h-4 w-4" />
          )}
          Watch Ad &amp; Earn {COINS_PER_AD} ORA
        </Button>
         {!canScratch && (
            <Button
              className="w-full"
              onClick={handleClaimScratch}
              disabled={isClaiming}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming...
                </>
              ) : (
                "Claim Scratch"
              )}
            </Button>
          )}
      </CardFooter>
    </Card>
  );
}

    

    