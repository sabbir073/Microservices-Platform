"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  FileText,
  HelpCircle,
  ClipboardList,
  Share2,
  Globe,
  Gift,
  Sparkles,
  Save,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// Task types with icons and colors
const taskTypes = [
  { id: "VIDEO", label: "Video", icon: Video, color: "red", description: "Watch videos to earn" },
  { id: "ARTICLE", label: "Article", icon: FileText, color: "blue", description: "Read articles to earn" },
  { id: "QUIZ", label: "Quiz", icon: HelpCircle, color: "amber", description: "Answer quiz questions" },
  { id: "SURVEY", label: "Survey", icon: ClipboardList, color: "purple", description: "Complete surveys" },
  { id: "SOCIAL", label: "Social", icon: Share2, color: "pink", description: "Social media engagement" },
  { id: "PROXY", label: "Proxy", icon: Globe, color: "cyan", description: "Geo-targeted browsing" },
  { id: "OFFERWALL", label: "Offerwall", icon: Gift, color: "emerald", description: "Complete offers" },
  { id: "CUSTOM", label: "Custom", icon: Sparkles, color: "indigo", description: "Custom task type" },
];

const packageTiers = [
  { id: "FREE", label: "Free" },
  { id: "BASIC", label: "Basic" },
  { id: "STANDARD", label: "Standard" },
  { id: "PREMIUM", label: "Premium" },
];

const socialPlatforms = [
  "Twitter/X",
  "Facebook",
  "Instagram",
  "YouTube",
  "TikTok",
  "LinkedIn",
  "Pinterest",
  "Discord",
  "Telegram",
  "Reddit",
  "Threads",
];

const socialActions = [
  "Follow",
  "Like",
  "Comment",
  "Share",
  "Subscribe",
  "Join Group",
  "Watch",
  "Retweet",
  "Save",
  "Upvote",
];

const countries = [
  { code: "ALL", name: "All Countries" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "NL", name: "Netherlands" },
  { code: "BD", name: "Bangladesh" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
];

interface TaskFormProps {
  task?: {
    id: string;
    title: string;
    description: string;
    instructions: string | null;
    type: string;
    status: string;
    pointsReward: number;
    xpReward: number;
    dailyLimit: number | null;
    totalLimit: number | null;
    minLevel: number;
    requiredPackage: string;
    countries: string[];
    contentUrl: string | null;
    thumbnailUrl: string | null;
    duration: number | null;
    questions: unknown;
    socialPlatform: string | null;
    socialAction: string | null;
    socialUrl: string | null;
    proxyInstructions: string | null;
    startsAt: Date | null;
    expiresAt: Date | null;
    cooldownMinutes: number;
    autoApprove: boolean;
  };
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export function TaskForm({ task }: TaskFormProps) {
  const router = useRouter();
  const isEditing = !!task;

  // Form state
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    instructions: task?.instructions || "",
    type: task?.type || "",
    pointsReward: task?.pointsReward || 0,
    xpReward: task?.xpReward || 0,
    dailyLimit: task?.dailyLimit || "",
    totalLimit: task?.totalLimit || "",
    minLevel: task?.minLevel || 1,
    requiredPackage: task?.requiredPackage || "FREE",
    countries: task?.countries || [],
    contentUrl: task?.contentUrl || "",
    thumbnailUrl: task?.thumbnailUrl || "",
    duration: task?.duration || "",
    socialPlatform: task?.socialPlatform || "",
    socialAction: task?.socialAction || "",
    socialUrl: task?.socialUrl || "",
    proxyInstructions: task?.proxyInstructions || "",
    startsAt: task?.startsAt ? new Date(task.startsAt).toISOString().slice(0, 16) : "",
    expiresAt: task?.expiresAt ? new Date(task.expiresAt).toISOString().slice(0, 16) : "",
    cooldownMinutes: task?.cooldownMinutes || 0,
    autoApprove: task?.autoApprove || false,
  });

  // Instructions steps
  const [instructionSteps, setInstructionSteps] = useState<string[]>(
    task?.instructions ? task.instructions.split("\n").filter(Boolean) : [""]
  );

  // Quiz questions
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    (task?.questions as QuizQuestion[]) || [
      { question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" },
    ]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Prepare the data
      const submitData = {
        ...formData,
        instructions: instructionSteps.filter(Boolean).join("\n"),
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit.toString()) : null,
        totalLimit: formData.totalLimit ? parseInt(formData.totalLimit.toString()) : null,
        duration: formData.duration ? parseInt(formData.duration.toString()) : null,
        startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        status: isDraft ? "PAUSED" : "ACTIVE",
        questions: formData.type === "QUIZ" ? questions : null,
      };

      const url = isEditing ? `/api/admin/tasks/${task.id}` : "/api/admin/tasks";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save task");
      }

      router.push("/admin/tasks");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const addInstructionStep = () => {
    setInstructionSteps([...instructionSteps, ""]);
  };

  const removeInstructionStep = (index: number) => {
    setInstructionSteps(instructionSteps.filter((_, i) => i !== index));
  };

  const updateInstructionStep = (index: number, value: string) => {
    const newSteps = [...instructionSteps];
    newSteps[index] = value;
    setInstructionSteps(newSteps);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: unknown) => {
    const newQuestions = [...questions];
    if (field === "question") {
      newQuestions[index].question = value as string;
    } else if (field === "correctAnswer") {
      newQuestions[index].correctAnswer = value as number;
    } else if (field === "explanation") {
      newQuestions[index].explanation = value as string;
    }
    setQuestions(newQuestions);
  };

  const updateQuestionOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const toggleCountry = (code: string) => {
    if (code === "ALL") {
      setFormData({ ...formData, countries: [] });
    } else {
      const newCountries = formData.countries.includes(code)
        ? formData.countries.filter((c) => c !== code)
        : [...formData.countries, code];
      setFormData({ ...formData, countries: newCountries });
    }
  };

  // Step 1: Type Selection
  if (!formData.type) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-white">Select Task Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {taskTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setFormData({ ...formData, type: type.id })}
                className={`p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-${type.color}-500/50 transition-all text-center group`}
              >
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-${type.color}-500/10 flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${type.color}-400`} />
                </div>
                <h3 className="font-medium text-white group-hover:text-indigo-400 transition-colors">
                  {type.label}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{type.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const selectedType = taskTypes.find((t) => t.id === formData.type);
  const TypeIcon = selectedType?.icon || Sparkles;

  return (
    <form onSubmit={(e) => handleSubmit(e)} className="space-y-8">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Task Type Indicator */}
      <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${selectedType?.color}-500/10`}>
            <TypeIcon className={`w-5 h-5 text-${selectedType?.color}-400`} />
          </div>
          <div>
            <p className="text-sm text-gray-400">Task Type</p>
            <p className="text-white font-medium">{selectedType?.label}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: "" })}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Change Type
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Basic Information</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Watch Product Review Video"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what users need to do to complete this task..."
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {(formData.type === "VIDEO" || formData.type === "ARTICLE") && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Content URL
                </label>
                <input
                  type="url"
                  value={formData.contentUrl}
                  onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Thumbnail URL
                </label>
                <input
                  type="url"
                  value={formData.thumbnailUrl}
                  onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Social Settings */}
      {formData.type === "SOCIAL" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Social Media Settings</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Platform <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.socialPlatform}
                onChange={(e) => setFormData({ ...formData, socialPlatform: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                <option value="">Select Platform</option>
                {socialPlatforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Action <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.socialAction}
                onChange={(e) => setFormData({ ...formData, socialAction: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                <option value="">Select Action</option>
                {socialActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Target URL / Username <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.socialUrl}
                onChange={(e) => setFormData({ ...formData, socialUrl: e.target.value })}
                placeholder="@username or https://..."
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Proxy Settings */}
      {formData.type === "PROXY" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Proxy Task Settings</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Target URL <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                required
                value={formData.contentUrl}
                onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Proxy Instructions
              </label>
              <textarea
                rows={3}
                value={formData.proxyInstructions}
                onChange={(e) => setFormData({ ...formData, proxyInstructions: e.target.value })}
                placeholder="Special instructions for proxy usage..."
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">
                Target Countries
              </label>
              <div className="flex flex-wrap gap-2">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => toggleCountry(country.code)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      country.code === "ALL"
                        ? formData.countries.length === 0
                          ? "bg-indigo-500 border-indigo-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                        : formData.countries.includes(country.code)
                        ? "bg-indigo-500 border-indigo-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {country.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Questions */}
      {formData.type === "QUIZ" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Quiz Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="p-4 bg-gray-800 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-400">
                    Question {qIndex + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => updateQuestion(qIndex, "question", e.target.value)}
                  placeholder="Enter question..."
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                />

                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Options (select correct answer)</p>
                  {q.options.map((option, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctAnswer === oIndex}
                        onChange={() => updateQuestion(qIndex, "correctAnswer", oIndex)}
                        className="w-4 h-4 text-indigo-500 bg-gray-900 border-gray-700"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateQuestionOption(qIndex, oIndex, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                        className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Explanation (shown after answer)
                  </label>
                  <input
                    type="text"
                    value={q.explanation}
                    onChange={(e) => updateQuestion(qIndex, "explanation", e.target.value)}
                    placeholder="Explain the correct answer..."
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Rewards</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Points Reward <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.pointsReward}
              onChange={(e) =>
                setFormData({ ...formData, pointsReward: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              XP Reward
            </label>
            <input
              type="number"
              min="0"
              value={formData.xpReward}
              onChange={(e) =>
                setFormData({ ...formData, xpReward: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Duration (seconds)
            </label>
            <input
              type="number"
              min="0"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="Minimum time required"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Requirements</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Minimum Level
            </label>
            <input
              type="number"
              min="1"
              value={formData.minLevel}
              onChange={(e) =>
                setFormData({ ...formData, minLevel: parseInt(e.target.value) || 1 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Required Package
            </label>
            <select
              value={formData.requiredPackage}
              onChange={(e) => setFormData({ ...formData, requiredPackage: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            >
              {packageTiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Cooldown (minutes)
            </label>
            <input
              type="number"
              min="0"
              value={formData.cooldownMinutes}
              onChange={(e) =>
                setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Limits */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Limits</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Daily Limit per User
            </label>
            <input
              type="number"
              min="0"
              value={formData.dailyLimit}
              onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
              placeholder="Blank = unlimited"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Total Slots
            </label>
            <input
              type="number"
              min="0"
              value={formData.totalLimit}
              onChange={(e) => setFormData({ ...formData, totalLimit: e.target.value })}
              placeholder="Blank = unlimited"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-8">
            <input
              type="checkbox"
              id="autoApprove"
              checked={formData.autoApprove}
              onChange={(e) => setFormData({ ...formData, autoApprove: e.target.checked })}
              className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-indigo-500"
            />
            <label htmlFor="autoApprove" className="text-sm text-gray-400">
              Auto-approve submissions
            </label>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Instructions</h2>
          <button
            type="button"
            onClick={addInstructionStep}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>

        <div className="space-y-3">
          {instructionSteps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-gray-800 rounded-lg text-sm text-gray-400">
                {index + 1}
              </span>
              <input
                type="text"
                value={step}
                onChange={(e) => updateInstructionStep(index, e.target.value)}
                placeholder={`Step ${index + 1} instructions...`}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
              />
              {instructionSteps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInstructionStep(index)}
                  className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scheduling */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Scheduling</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.startsAt}
              onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => router.push("/admin/tasks")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
          Cancel
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save as Draft
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isEditing ? "Update Task" : "Publish Task"}
          </button>
        </div>
      </div>
    </form>
  );
}
