import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ListTodo,
  Play,
  Youtube,
  Instagram,
  Facebook,
  Twitter,
  Globe,
  Star,
  Clock,
  Coins,
  Filter,
  Search,
} from "lucide-react";
import Link from "next/link";

// Task Card Component
function TaskCard({
  title,
  description,
  points,
  xp,
  type,
  duration,
  difficulty,
}: {
  title: string;
  description: string;
  points: number;
  xp: number;
  type: "video" | "social" | "survey" | "app";
  duration: string;
  difficulty: "Easy" | "Medium" | "Hard";
}) {
  const typeConfig = {
    video: { icon: Play, color: "bg-red-500/10 text-red-400" },
    social: { icon: Globe, color: "bg-blue-500/10 text-blue-400" },
    survey: { icon: ListTodo, color: "bg-purple-500/10 text-purple-400" },
    app: { icon: Globe, color: "bg-emerald-500/10 text-emerald-400" },
  };

  const difficultyColor = {
    Easy: "text-emerald-400 bg-emerald-500/10",
    Medium: "text-amber-400 bg-amber-500/10",
    Hard: "text-red-400 bg-red-500/10",
  };

  const { icon: TypeIcon, color } = typeConfig[type];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <TypeIcon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {description}
              </p>
            </div>
            <span
              className={`shrink-0 px-2 py-1 text-xs font-medium rounded-full ${difficultyColor[difficulty]}`}
            >
              {difficulty}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-white font-medium">{points}</span>
              <span className="text-gray-500">pts</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="w-4 h-4 text-indigo-400" />
              <span className="text-white font-medium">{xp}</span>
              <span className="text-gray-500">XP</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              {duration}
            </div>
          </div>
        </div>
      </div>
      <button className="w-full mt-4 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 font-medium rounded-lg hover:bg-indigo-500/20 transition-colors">
        Start Task
      </button>
    </div>
  );
}

export default async function TasksPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <p className="text-gray-400 mt-1">
          Complete tasks to earn points and XP
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Available Tasks</p>
          <p className="text-2xl font-bold text-white mt-1">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Completed Today</p>
          <p className="text-2xl font-bold text-white mt-1">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Points Earned</p>
          <p className="text-2xl font-bold text-white mt-1">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">XP Earned</p>
          <p className="text-2xl font-bold text-white mt-1">0</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="search"
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <select className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500">
            <option value="all">All Types</option>
            <option value="video">Video</option>
            <option value="social">Social</option>
            <option value="survey">Survey</option>
            <option value="app">App</option>
          </select>
          <select className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500">
            <option value="all">All Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Task Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Video", "Social", "Survey", "App", "Daily"].map((cat) => (
          <button
            key={cat}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              cat === "All"
                ? "bg-indigo-500 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tasks Grid */}
      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="text-center">
          <ListTodo className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No tasks available right now</p>
          <p className="text-sm mt-2">
            Check back soon for new earning opportunities!
          </p>
        </div>
      </div>
    </div>
  );
}
