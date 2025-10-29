import { FirebaseClientProvider } from "@/firebase/client-provider";
import WalletPageContent from "./wallet-page-content";


export default function WalletPage() {
  return (
    <FirebaseClientProvider>
      <WalletPageContent />
    </FirebaseClientProvider>
  )
}
