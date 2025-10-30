"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase/auth/use-user";

export default function HomePageContent() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <p>Loading...</p>
      </main>
    );
  }

  // This will likely not be seen as the redirect will happen,
  // but it's good practice to have a fallback.
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <p>Redirecting...</p>
    </main>
  );
}
