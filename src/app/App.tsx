import { AppShell } from "./AppShell";
import { PreviewPage } from "./PreviewPage";
import { usePage } from "./router";

export function App() {
  const page = usePage();

  return (
    <AppShell currentPage={page}>
      <PreviewPage page={page} />
    </AppShell>
  );
}
