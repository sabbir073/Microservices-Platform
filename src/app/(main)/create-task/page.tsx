import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateTaskView } from "@/components/user/tasks/create-task-view";
import { getEffectiveFeatures } from "@/lib/packages";
import { getPointsPerUsd } from "@/lib/economy";
import { FeatureLock } from "@/components/user/primitives/feature-lock";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { getTaskCredit } from "@/lib/task-credit";

export default async function CreateTaskPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enabled } = await getEffectiveFeatures(session.user.id);
  if (!enabled.has("createTasks")) return <FeatureLock title="Create Task" />;

  const [pointsPerUsd, buyer, taskCredit] = await Promise.all([
    getPointsPerUsd(),
    getBuyerSettings(),
    getTaskCredit(session.user.id),
  ]);

  // The admin master switch closes the form as well as the API. Showing the
  // form and failing on submit would waste the buyer's time composing a task
  // that was never going to be accepted.
  if (!buyer.enabled || buyer.allowedTaskTypes.length === 0) {
    return (
      <FeatureLock
        title="Create Task"
        message="Buyer task creation is turned off at the moment. Please check back later."
      />
    );
  }

  return (
    <CreateTaskView
      pointsPerUsd={pointsPerUsd}
      canTarget={enabled.has("targetTasks")}
      feePercent={buyer.feePercent}
      minPoints={buyer.minPointsPerTask}
      maxPoints={buyer.maxPointsPerTask}
      maxCompletions={buyer.maxCompletions}
      allowedTypes={buyer.allowedTaskTypes}
      needsReview={!buyer.autoApproveTasks}
      taskCredit={taskCredit}
    />
  );
}
