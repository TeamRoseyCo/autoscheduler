import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup-wizard";

export default function SetupPage() {
  const hasGoogle =
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_ID !== "your-google-client-id" &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_SECRET !== "your-google-client-secret" &&
    process.env.AUTH_SECRET &&
    process.env.AUTH_SECRET !== "generate-a-random-secret-here";

  if (hasGoogle) redirect("/");

  return <SetupWizard />;
}
