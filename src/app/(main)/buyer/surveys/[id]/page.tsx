import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BuyerSurveyResponsesView } from "@/components/user/buyer/survey-responses-view";

/**
 * A buyer reading their own survey's answers.
 *
 * Ownership is enforced by the API (`fundedByUserId` is in the WHERE clause),
 * not here — this page only needs a session, and a buyer who follows a link to
 * somebody else's survey gets the same "not found" the API returns.
 */
export default async function BuyerSurveyResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <BuyerSurveyResponsesView taskId={id} />;
}
