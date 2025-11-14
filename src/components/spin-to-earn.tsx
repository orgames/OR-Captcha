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
import {
  Clapperboard,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, collection, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const COINS_PER_AD = 25;
const spinPrizes = [1, 5, 10, 2, 20, 0, 5, 2];
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

const Wheel = ({ rotation }: { rotation: number }) => (
  <div className="relative w-64 h-64 md:w-80 md:h-80">
    <div
      className="absolute inset-0 transition-transform duration-5000 ease-out"
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

          return (
            <g key={i}>
              <path d={d} fill={i % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--card))'} stroke="hsl(var(--border))" strokeWidth="1"/>
              <text x={textX} y={textY} fill="hsl(var(--primary-foreground))" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${angle + 90}, ${textX}, ${textY})`} className="font-bold text-lg">{prize}</text>
            </g>
          );
        })}
      </svg>
    </div>
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}>
       <div className="w-8 h-8 bg-destructive rounded-sm rotate-45" />
    </div>
  </div>
);

export default function SpinToEarn() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, loading: userProfileLoading } = useDoc<any>(userDocRef?.path);

  const [isSpinning, startSpinning] = useTransition();
  const [isAdRunning, startAd] = useTransition();
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

  const addTransaction = async (amount: number, type: 'spin' | 'ad') => {
    if (!user || !firestore) return;
    
    const userRef = doc(firestore, 'users', user.uid);
    const transactionsRef = collection(firestore, 'users', user.uid, 'transactions');
    const newTransactionRef = doc(transactionsRef);

    const transactionData = {
      amount,
      type,
      timestamp: serverTimestamp(),
    };
    
    const userUpdate = setDoc(userRef, { coinBalance: increment(amount) }, { merge: true });
    const transactionUpdate = setDoc(newTransactionRef, transactionData);

    Promise.all([userUpdate, transactionUpdate]).catch((error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { coinBalance: `increment(${amount})` },
            });
            errorEmitter.emit('permission-error', permissionError);
            const permissionError2 = new FirestorePermissionError({
                path: newTransactionRef.path,
                operation: 'create',
                requestResourceData: transactionData
            });
            errorEmitter.emit('permission-error', permissionError2);
        } else {
            console.error("Transaction failed: ", error);
            toast({
                title: "An unexpected error occurred",
                description: "Could not complete the transaction. Please try again.",
                variant: "destructive"
            });
        }
    });
  };

  const handleSpin = () => {
    if (isSpinning || isAdRunning) return;
    
    startSpinning(async () => {
        const winningPrizeIndex = Math.floor(Math.random() * TOTAL_PRIZES);
        const prizeAmount = spinPrizes[winningPrizeIndex];

        const baseRotations = 5; 
        const prizeAngle = (360 / TOTAL_PRIZES) * (TOTAL_PRIZES - winningPrizeIndex);
        const randomOffset = (Math.random() - 0.5) * (360 / TOTAL_PRIZES) * 0.8;
        const newRotation = rotation + (baseRotations * 360) + prizeAngle + randomOffset;

        setRotation(newRotation);

        // Wait for spin animation to finish
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (prizeAmount > 0) {
            await addTransaction(prizeAmount, 'spin');
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
    });
  }

  const handleWatchAd = () => {
    if (isSpinning || isAdRunning || !user) return;
    startAd(async () => {
       setTimeout(async () => {
          await addTransaction(COINS_PER_AD, 'ad');
          setAnimationTrigger(Date.now());
       }, 3000);
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
      <CardContent className="flex flex-col items-center justify-center space-y-8">
        <Wheel rotation={rotation} />
        <Button
            onClick={handleSpin}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isSpinning || isAdRunning}
        >
            {isSpinning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Spinning...
              </>
            ) : (
                "Spin the Wheel!"
            )}
        </Button>
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
