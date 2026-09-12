import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvResponse, toCsv } from "@/lib/csv";
import { type SurveyConfig } from "@/lib/survey-tasks";
import {
  aggregateBuyerSurvey,
  buyerCsvHeaders,
  buyerCsvRow,
  surveyQuestions,
  toBuyerResponseRows,
  type SurveySubmissionLike,
} from "@/lib/survey-buyer";

/**
 * The buyer reading their own survey's answers.
 *
 * `?format=csv` downloads the same rows as a spreadsheet, `?format=json`
 * returns them as a file for anything that has to process them; the default is
 * the JSON the on-screen view renders.
 *
 * Every shape goes through `toBuyerResponseRows`, which is the ONLY place that
 * decides what a buyer may see — read the privacy rule at the top of
 * `src/lib/survey-buyer.ts` before adding a field here. In particular this
 * route never selects `user`, and never selects `proofUrl`/`screenshotUrl`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Ownership is in the WHERE clause, not checked afterwards: this is somebody
  // else's answers unless this buyer funded the task.
  const task = await prisma.task.findFirst({
    where: { id, fundedByUserId: session.user.id },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      surveyConfig: true,
      totalLimit: true,
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.type !== "SURVEY") {
    return NextResponse.json({ error: "Not a survey task" }, { status: 400 });
  }

  const cfg = (task.surveyConfig ?? null) as SurveyConfig | null;

  // Rejected work is left out on purpose. A rejected submission is one a
  // reviewer judged invalid — counting it would put rubbish in the buyer's
  // results, and the buyer was never charged for it either.
  const rows = (await prisma.taskSubmission.findMany({
    where: {
      taskId: id,
      status: { in: ["PENDING", "APPROVED", "AUTO_APPROVED"] },
    },
    select: { userId: true, createdAt: true, answers: true },
    orderBy: { createdAt: "asc" },
  })) as unknown as SurveySubmissionLike[];

  const responses = toBuyerResponseRows(cfg, rows);
  const questions = surveyQuestions(cfg).map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    required: q.required,
    options: q.options ?? [],
    scale: q.scale ?? null,
  }));

  const format = (req.nextUrl.searchParams.get("format") ?? "").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = toCsv(
      buyerCsvHeaders(cfg),
      responses.map((r) => buyerCsvRow(cfg, r))
    );
    return csvResponse(csv, `survey-${task.id}-responses-${stamp}.csv`);
  }

  if (format === "json") {
    return new NextResponse(
      JSON.stringify({ task: { id: task.id, title: task.title }, questions, responses }, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="survey-${task.id}-responses-${stamp}.json"`,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      target: task.totalLimit ?? 0,
    },
    questions,
    stats: aggregateBuyerSurvey(cfg, rows),
    responses,
    total: responses.length,
  });
}
