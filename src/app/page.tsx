import { FirebaseClientProvider } from "@/firebase/client-provider";
import HomePageContent from "./home-page-content";

export default function Home() {
  return (
    <FirebaseClientProvider>
      <HomePageContent />
    </FirebaseClientProvider>
  );
}
