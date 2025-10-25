import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
          <span className="text-4xl font-bold text-primary-foreground">O</span>
        </div>
        <h1 className="text-4xl font-bold text-center">Welcome to ORA Captcha</h1>
        <p className="text-muted-foreground text-center">
          Sign in to start earning ORA coins.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
