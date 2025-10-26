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
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Clapperboard,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, collection, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { validateUserCaptchaEntry } from "@/app/actions";

const CHARACTERS = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
const CAPTCHA_LENGTH = 6;
const COINS_PER_CAPTCHA = 10;
const COINS_PER_AD = 25;

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

export default function CoinCaptcha() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, loading: userProfileLoading } = useDoc<any>(userDocRef?.path ?? `users/nouser`);

  const [userInput, setUserInput] = useState("");
  const [captchaText, setCaptchaText] = useState("");
  const [isVerifying, startVerification] = useTransition();
  const [isAdRunning, startAd] = useTransition();
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const generateCaptcha = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let newCaptchaText = "";
    for (let i = 0; i < CAPTCHA_LENGTH; i++) {
      newCaptchaText += CHARACTERS.charAt(
        Math.floor(Math.random() * CHARACTERS.length)
      );
    }
    setCaptchaText(newCaptchaText);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#E2F3FF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `hsla(200, 67%, 84%, ${Math.random() * 0.5 + 0.3})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineWidth = Math.random() * 2;
      ctx.stroke();
    }
    
    const chars = newCaptchaText.split("");
    const charWidth = canvas.width / (chars.length + 1);
    chars.forEach((char, i) => {
      ctx.save();
      const x = charWidth * (i + 0.8);
      const y = canvas.height / 2 + (Math.random() - 0.5) * 10;
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.4);
      ctx.font = `bold ${28 + Math.random() * 6}px "PT Sans"`;
      ctx.fillStyle = `hsl(210, 20%, ${20 + Math.random() * 15}%)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });

    for (let i = 0; i < 150; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = `hsla(0, 0%, 50%, ${Math.random() * 0.2})`;
        ctx.fillRect(x, y, 2, 2);
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const addTransaction = async (amount: number, type: 'captcha' | 'ad') => {
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


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userInput || isVerifying || isAdRunning) return;

    startVerification(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const captchaImage = canvas.toDataURL("image/png");

      const result = await validateUserCaptchaEntry(captchaImage, userInput);

      if (result.isValid) {
        await addTransaction(COINS_PER_CAPTCHA, 'captcha');
        setAnimationTrigger(Date.now());
      } else {
        toast({
          title: "Incorrect Captcha",
          description: "Please try again. The captcha is case-insensitive.",
          variant: "destructive",
        });
      }
      setUserInput("");
      generateCaptcha();
    });
  };

  const handleWatchAd = () => {
    if (isVerifying || isAdRunning || !user) return;
    startAd(async () => {
       setTimeout(async () => {
          await addTransaction(COINS_PER_AD, 'ad');
          setAnimationTrigger(Date.now());
          // Note: isAdRunning is automatically set to false after this async function completes.
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
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative bg-muted rounded-lg p-2 flex justify-center items-center">
            <canvas ref={canvasRef} width="250" height="70" className="rounded-md" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={generateCaptcha}
              disabled={isVerifying || isAdRunning}
              className="absolute top-2 right-2 h-8 w-8"
              aria-label="Refresh Captcha"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <label htmlFor="captcha-input" className="text-sm font-medium text-muted-foreground">Enter the text from the image above</label>
            <Input
              id="captcha-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Your answer..."
              required
              disabled={isVerifying || isAdRunning}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isVerifying || isAdRunning}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Submit & Earn {COINS_PER_CAPTCHA} ORA
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full border-accent text-accent-foreground hover:bg-accent/20 hover:text-accent-foreground"
          onClick={handleWatchAd}
          disabled={isVerifying || isAdRunning}
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
