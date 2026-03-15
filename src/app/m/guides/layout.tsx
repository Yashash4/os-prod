import Shell from "@/components/Shell";
import AuthGuard from "@/components/AuthGuard";

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Shell>{children}</Shell>
    </AuthGuard>
  );
}
