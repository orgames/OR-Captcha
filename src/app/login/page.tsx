
import { LoginForm } from "@/components/auth/login-form";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import Link from "next/link";

export default function LoginPage() {
  return (
    <FirebaseClientProvider>
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <span className="text-4xl font-bold text-primary-foreground">S</span>
          </div>
          <h1 className="text-4xl font-bold text-center">Welcome back to Spin and Earn</h1>
          <p className="text-muted-foreground text-center">
            Sign in to continue earning coins.
          </p>
        </div>
        <LoginForm />
        <p className="text-sm text-muted-foreground mt-4">
          Don't have an account?{' '}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </main>
    </FirebaseClientProvider>
  );
}
