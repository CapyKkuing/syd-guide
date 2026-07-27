import { AppShell } from "./AppShell";
import { PreviewPage } from "./PreviewPage";
import { PairDevicePage } from "../features/auth/PairDevicePage";
import { PairingManager } from "../features/auth/PairingManager";
import { usePage } from "./router";

export function App({ pairToken = null }: { pairToken?: string | null }) {
  const page = usePage();

  if (page === "pair") return <PairDevicePage token={pairToken} />;

  return (
    <AppShell currentPage={page}>
      <PreviewPage page={page} />
      {page === "more" && <PairingManager />}
    </AppShell>
  );
}
