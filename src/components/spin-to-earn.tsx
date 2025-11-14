
"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
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
  Clapperboard,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, collection, runTransaction, serverTimestamp } from "firebase/firestore";

const COINS_PER_AD = 25;
const spinPrizes = [1, 2, 0, 1, 2, 3, 1, 0];
const TOTAL_PRIZES = spinPrizes.length;

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
  const [isAdRunning, startAd] = useTransition();
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

  const handleSpin = () => {
    if (isSpinning || isAdRunning) {
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
        
        try {
            await runTransaction(firestore, async (transaction) => {
              const userDoc = await transaction.get(userRef);
              if (!userDoc.exists()) throw new Error("User document does not exist.");
              
              const newBalance = (userDoc.data().coinBalance || 0) + prizeAmount;
              
              const updates: any = {
                  coinBalance: newBalance,
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
                    description: `You've won ${prizeAmount} ORA coins.`,
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
    if (isSpinning || isAdRunning || !user || !firestore) return;
    startAd(async () => {
       await new Promise(resolve => setTimeout(resolve, 3000));
       const userRef = doc(firestore, 'users', user.uid);
       const transactionRef = doc(collection(userRef, 'transactions'));
       
       try {
            await runTransaction(firestore, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User not found");

                const newBalance = (userDoc.data().coinBalance || 0) + COINS_PER_AD;
                transaction.update(userRef, { coinBalance: newBalance });
                transaction.set(transactionRef, {
                    type: 'ad' as const,
                    amount: COINS_PER_AD,
                    timestamp: serverTimestamp(),
                });
            });
            setAnimationTrigger(Date.now());
            refetch();
       } catch (error: any) {
            console.error("Ad reward transaction failed: ", error);
             toast({
                title: error.message || "An unexpected error occurred",
                description: "Could not claim ad reward. Please try again.",
                variant: "destructive"
            });
       }
    });
  };

  return (
    <Card className="w-full max-w-md shadow-lg relative overflow-visible">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="font-headline">Your Balance</CardTitle>
            <CardDescription>ORA coins earned from tasks</CardDescription>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 bg-accent/30 text-accent-foreground p-2 rounded-lg">
              <OraCoin className="w-8 h-8" />
              <span className="text-3xl font-bold font-headline">
                {userProfileLoading ? '...' : userProfile?.coinBalance || 0}
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
        <Wheel rotation={rotation} onSpin={handleSpin} isSpinning={isSpinning} />
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full border-accent text-accent-foreground hover:bg-accent/20 hover:text-accent-foreground"
          onClick={handleWatchAd}
          disabled={isSpinning || isAdRunning}
        >
          {isAdRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rewarding...
            </>
          ) : (
            <>
              <Clapperboard className="mr-2 h-4 w-4" /> Watch Ad & Earn {COINS_PER_AD} ORA
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
