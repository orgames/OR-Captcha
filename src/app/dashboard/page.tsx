
import { FirebaseClientProvider } from "@/firebase/client-provider";
import DashboardPageContent from "./dashboard-page-content";

export default function DashboardPage() {
  return (
    <FirebaseClientProvider>
      <DashboardPageContent />
    </FirebaseClientProvider>
  );
}
