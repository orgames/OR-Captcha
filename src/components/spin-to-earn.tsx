
"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Clapperboard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, collection, runTransaction, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";

const spinPrizes = [1, 2, 0, 1, 2, 3, 1, 0];
const TOTAL_PRIZES = spinPrizes.length;
const DAILY_SPIN_LIMIT = 20;
const COINS_PER_AD = 0.5;


const Coin = ({ className }: { className?: string }) => (
    <div className={`w-8 h-8 rounded-full bg-accent flex items-center justify-center ${className}`}>
        <span className="text-lg font-bold text-accent-foreground">S</span>
    </div>
);

const CoinReward = ({ className }: { className?: string }) => (
    <div className={`w-12 h-12 rounded-full bg-accent flex items-center justify-center ${className}`}>
        <span className="text-2xl font-bold text-accent-foreground">S</span>
    </div>
);

const Wheel = ({ rotation, onSpin, isSpinning }: { rotation: number, onSpin: () => void, isSpinning: boolean }) => (
  <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
    <div
      className="absolute inset-0 transition-transform duration-[5000ms] ease-out"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {spinPrizes.map((prize, i) => {
          const angle = (360 / TOTAL_PRIZES) * i;
          const startAngle = angle - (360 / TOTAL_PRIZES / 2);
          const endAngle = angle + (360 / TOTAL_PRIZES / 2);

          const start = {
            x: 100 + 100 * Math.cos(Math.PI * startAngle / 180),
            y: 100 + 100 * Math.sin(Math.PI * startAngle / 180),
          };
          const end = {
            x: 100 + 100 * Math.cos(Math.PI * endAngle / 180),
            y: 100 + 100 * Math.sin(Math.PI * endAngle / 180),
          };

          const largeArcFlag = (endAngle - startAngle) <= 180 ? "0" : "1";

          const d = [
            "M", 100, 100,
            "L", start.x, start.y,
            "A", 100, 100, 0, largeArcFlag, 1, end.x, end.y,
            "Z",
          ].join(" ");
          
          const textAngle = angle * Math.PI / 180;
          const textX = 100 + 70 * Math.cos(textAngle);
          const textY = 100 + 70 * Math.sin(textAngle);
          
          const prizeText = prize === 0 && i === 2 ? "Miss" : prize;

          return (
            <g key={i}>
              <path d={d} fill={i % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--card))'} stroke="hsl(var(--border))" strokeWidth="1"/>
              <text x={textX} y={textY} fill="hsl(var(--primary-foreground))" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${angle + 90}, ${textX}, ${textY})`} className="font-bold text-lg">{prizeText}</text>
            </g>
          );
        })}
      </svg>
    </div>
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2" style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '20px solid hsl(var(--destructive))' }}></div>
    <Button
        onClick={onSpin}
        className="w-24 h-24 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xl font-bold shadow-lg"
        disabled={isSpinning}
        style={{ zIndex: 10 }}
    >
        {isSpinning ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
            "Spin!"
        )}
    </Button>
  </div>
);

export default function SpinToEarn() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, loading: userProfileLoading, refetch } = useDoc<any>(userDocRef?.path);

  const [isSpinning, startSpinning] = useTransition();
  const [isClaiming, startClaiming] = useTransition();
  const [isAdRunning, startAd] = useTransition();
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

  const spinsToday = userProfile?.spinsToday || 0;
  const canSpin = spinsToday < DAILY_SPIN_LIMIT;

  const handleSpin = () => {
    if (isSpinning || isClaiming || !canSpin || isAdRunning) {
       if (!canSpin) {
        toast({
          title: "Daily limit reached",
          description: `You have used all your ${DAILY_SPIN_LIMIT} spins for today.`,
          variant: "destructive"
        });
      }
      return;
    }
    
    startSpinning(async () => {
        const winningPrizeIndex = Math.floor(Math.random() * TOTAL_PRIZES);
        const prizeAmount = spinPrizes[winningPrizeIndex];

        const baseRotations = 5;
        const segmentAngle = 360 / TOTAL_PRIZES;
        const prizeAngle = 360 - (winningPrizeIndex * segmentAngle); 
        const randomOffset = (Math.random() - 0.5) * segmentAngle * 0.8;
        const targetRotation = (baseRotations * 360) + prizeAngle + randomOffset;

        setRotation(prev => prev + targetRotation - (prev % 360));
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (!user || !firestore) return;
        const userRef = doc(firestore, 'users', user.uid);
        const today = format(new Date(), 'yyyy-MM-dd');

        try {
            await runTransaction(firestore, async (transaction) => {
              const userDoc = await transaction.get(userRef);
              if (!userDoc.exists()) throw new Error("User document does not exist.");
              
              const userData = userDoc.data();
              const currentSpins = userData.lastSpinDate === today ? userData.spinsToday : 0;
              
              if(currentSpins >= DAILY_SPIN_LIMIT) {
                throw new Error("Daily spin limit reached.");
              }

              const newBalance = (userData.coinBalance || 0) + prizeAmount;
              
              const updates: any = {
                  coinBalance: newBalance,
                  spinsToday: currentSpins + 1,
                  lastSpinDate: today,
              };

              transaction.update(userRef, updates);

              if (prizeAmount > 0) {
                const transactionRef = doc(collection(userRef, 'transactions'));
                transaction.set(transactionRef, {
                    type: 'spin' as const,
                    amount: prizeAmount,
                    timestamp: serverTimestamp(),
                });
              }
            });

            if (prizeAmount > 0) {
                setAnimationTrigger(Date.now());
                toast({
                    title: "You Won!",
                    description: `You've won ${prizeAmount} coins.`,
                });
            } else {
                toast({
                    title: "Better Luck Next Time!",
                    description: "You didn't win any coins this time. Try again!",
                    variant: "default",
                });
            }
        } catch (error: any) {
             toast({
                title: error.message || "An unexpected error occurred",
                description: "Could not record your spin. Please try again.",
                variant: "destructive"
            });
        } finally {
            refetch();
        }
    });
  }
  
  const handleWatchAd = () => {
    if (isSpinning || isClaiming || !user || !firestore || isAdRunning) return;
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
                description: `You've won ${newPrize} coins.`,
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


  const handleClaimSpin = () => {
    if (!user || !firestore || canSpin) return;

    startClaiming(async () => {
       await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate watching an ad
       const userRef = doc(firestore, 'users', user.uid);
       
       try {
            await runTransaction(firestore, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User not found");

                const currentSpins = userDoc.data().spinsToday || 0;
                if (currentSpins < DAILY_SPIN_LIMIT) {
                    throw new Error("You can still spin!");
                }
                
                transaction.update(userRef, { spinsToday: currentSpins - 1 });

                const transactionRef = doc(collection(userRef, 'transactions'));
                 transaction.set(transactionRef, {
                    type: 'ad' as const,
                    amount: 0, // No coin reward, just a spin
                    timestamp: serverTimestamp(),
                });
            });
            toast({
                title: "Spin Claimed!",
                description: "You have received one extra spin.",
            });
            refetch();
       } catch (error: any) {
            toast({
                title: "Claim Failed",
                description: error.message || "Could not claim a spin. Please try again.",
                variant: "destructive"
            });
       }
    });
  };

  const remainingSpins = DAILY_SPIN_LIMIT - spinsToday;

  return (
    <Card className="w-full max-w-md shadow-lg relative overflow-visible">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="font-headline">Your Balance</CardTitle>
            <CardDescription>
                {userProfileLoading ? '...' : `${remainingSpins < 0 ? 0 : remainingSpins} spins left today`}
            </CardDescription>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 bg-accent/30 text-accent-foreground p-2 rounded-lg">
              <Coin className="w-8 h-8" />
              <span className="text-3xl font-bold font-headline">
                {userProfileLoading ? '...' : userProfile?.coinBalance || 0}
              </span>
            </div>
            {animationTrigger > 0 && (
              <div
                key={animationTrigger}
                className="absolute inset-0 flex items-center justify-center"
              >
                <CoinReward className="animate-coin-reward" />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center space-y-4">
        <Wheel rotation={rotation} onSpin={handleSpin} isSpinning={isSpinning || !canSpin} />
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full border-accent text-accent-foreground hover:bg-accent/20 hover:text-accent-foreground"
          onClick={handleWatchAd}
          disabled={isSpinning || isClaiming || isAdRunning}
        >
          {isAdRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clapperboard className="mr-2 h-4 w-4" />
          )}
          Watch Ad &amp; Earn {COINS_PER_AD} Coins
        </Button>
         {!canSpin && (
          <Button
            className="w-full"
            onClick={handleClaimSpin}
            disabled={isClaiming || isSpinning}
          >
            {isClaiming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming...
              </>
            ) : (
              "Claim Spin"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
