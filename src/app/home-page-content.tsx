
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

  // Show a loading state while we determine the user's auth status
  // and redirect them.
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <p>Loading...</p>
    </main>
  );
}
