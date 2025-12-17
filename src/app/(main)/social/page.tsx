import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MessageSquare, Heart, Share2, Image } from "lucide-react";

export default async function SocialPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Social Feed</h1>
        <p className="text-gray-400 mt-1">Connect with the community</p>
      </div>

      {/* Create Post */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium shrink-0">
            {session.user.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1">
            <textarea
              placeholder="Share something with the community..."
              className="w-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none resize-none"
              rows={3}
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <Image className="w-5 h-5" />
              </button>
              <button className="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors">
                Post
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No posts yet</p>
          <p className="text-sm mt-2">Be the first to share something!</p>
        </div>
      </div>
    </div>
  );
}
