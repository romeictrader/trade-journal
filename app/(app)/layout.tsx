import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#13131a" }}>
      <Sidebar userEmail={user.email ?? ""} />
      <Header />
      <main
        style={{
          marginLeft: 200,
          paddingTop: 52,
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}
