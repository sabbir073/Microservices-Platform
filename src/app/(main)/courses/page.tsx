import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GraduationCap, Clock, Star, Play } from "lucide-react";

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Courses</h1>
        <p className="text-gray-400 mt-1">Learn and earn with our courses</p>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Earning", "Crypto", "Marketing", "Skills"].map((cat, i) => (
          <button
            key={cat}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              i === 0 ? "bg-indigo-500 text-white" : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="text-center">
          <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No courses available yet</p>
          <p className="text-sm mt-2">Courses will be added soon!</p>
        </div>
      </div>
    </div>
  );
}
