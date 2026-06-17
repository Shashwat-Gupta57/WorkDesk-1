import { redirect } from "next/navigation";

// Root entry → send everyone to the dashboard. The edge proxy redirects
// unauthenticated users on to /login (and back here once signed in).
export default function Home() {
  redirect("/dashboard");
}
