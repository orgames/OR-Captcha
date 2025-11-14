
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, collection, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const scratchPrizes = [1, 5, 10, 2, 25, 0, 5, 2, 50, 0];
const SCRATCH_RADIUS = 20;

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

  const { data: userProfile, loading: userProfileLoading } = useDoc<any>(userDocRef?.path);

  const [isRevealing, startRevealing] = useTransition();
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [isCardScratched, setIsCardScratched] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const addTransaction = async (amount: number, type: 'scratch') => {
    if (!user || !firestore || amount <= 0) return;

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
          requestResourceData: transactionData,
        });
        errorEmitter.emit('permission-error', permissionError2);
      } else {
        console.error("Transaction failed: ", error);
        toast({
          title: "An unexpected error occurred",
          description: "Could not complete the transaction. Please try again.",
          variant: "destructive",
        });
      }
    });
  };
  
  const setupCanvas = (prize: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set background prize
    ctx.fillStyle = 'hsl(var(--card))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 48px "PT Sans"';
    ctx.fillStyle = 'hsl(var(--accent))';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${prize} ORA`, canvas.width / 2, canvas.height / 2);

    // Set foreground scratch layer
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = '16px "PT Sans"';
    ctx.fillStyle = 'hsl(var(--muted-foreground))';
    ctx.fillText('Scratch to reveal your prize!', canvas.width / 2, canvas.height / 2);

    setIsCardScratched(false);
  };
  
  const getNewCard = () => {
    const newPrize = scratchPrizes[Math.floor(Math.random() * scratchPrizes.length)];
    setPrizeAmount(newPrize);
    setupCanvas(newPrize);
  };

  useEffect(() => {
    getNewCard();
  }, []);
  
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
    if (!canvas || isCardScratched) return;
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
    startRevealing(async () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                 // Redraw prize
                ctx.fillStyle = 'hsl(var(--card))';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = 'bold 48px "PT Sans"';
                ctx.fillStyle = 'hsl(var(--accent))';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${prizeAmount} ORA`, canvas.width / 2, canvas.height / 2);
            }
        }
        if (prizeAmount > 0) {
            await addTransaction(prizeAmount, 'scratch');
            setAnimationTrigger(Date.now());
            toast({
                title: "You Won!",
                description: `You've won ${prizeAmount} ORA coins.`,
            });
        } else {
            toast({
                title: "Better Luck Next Time!",
                description: "You didn't win any coins this time. Try again!",
            });
        }
    });
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
          className="rounded-md border-2 border-dashed border-muted-foreground cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full border-accent text-accent-foreground hover:bg-accent/20 hover:text-accent-foreground"
          onClick={getNewCard}
          disabled={isRevealing}
        >
          {isRevealing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isCardScratched ? "Play Again" : "Get New Card"}
        </Button>
      </CardFooter>
    </Card>
  );
}
