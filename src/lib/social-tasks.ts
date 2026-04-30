/**
 * Social Media Task Taxonomy
 * --------------------------
 * Single source of truth for all platforms × actions × required fields.
 *
 * Each platform has its own set of actions. Each action defines:
 * - adminFields: fields the admin fills out when creating the task
 * - proofFields: fields the user submits as proof of completion
 * - supportsAiPrompt: whether the action can use an AI-generated prompt
 *   instead of static title/body content
 */

export type FieldType =
  | "text"
  | "url"
  | "textarea"
  | "number"
  | "screenshot"
  | "image-url"
  | "select";

export interface SocialField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  options?: string[];
}

export interface SocialAction {
  key: string;
  label: string;
  emoji: string;
  description: string;
  adminFields: SocialField[];
  proofFields: SocialField[];
  /**
   * If true, admin can replace static "content" admin fields with an AI prompt
   * that the user will use to generate their own post content via Gemini/etc.
   * Set to true for actions that involve creating new content.
   */
  supportsAiPrompt: boolean;
  /** Which adminField keys are AI-generatable (replaced by `aiPrompt` when toggle is on) */
  aiGeneratableFields?: string[];
  /** Suggested points reward range */
  suggestedReward?: { min: number; max: number };
}

export interface SocialPlatform {
  key: string;
  label: string;
  emoji: string;
  brandColor: string; // tailwind class fragment, e.g. "bg-[#1877f2]"
  websiteUrl: string;
  actions: SocialAction[];
}

// -----------------------------------------------------------------------------
// Reusable field templates (DRY)
// -----------------------------------------------------------------------------

const fieldUrl = (key: string, label: string, placeholder = "https://..."): SocialField => ({
  key,
  label,
  type: "url",
  required: true,
  placeholder,
});

const fieldHandle = (key: string, label: string): SocialField => ({
  key,
  label,
  type: "text",
  required: true,
  placeholder: "@username or full URL",
});

const fieldScreenshot: SocialField = {
  key: "screenshotUrl",
  label: "Screenshot (URL or upload)",
  type: "screenshot",
  required: true,
  helperText: "Upload a screenshot showing the completed action.",
};

const fieldProofUrl = (label = "Profile / Action URL"): SocialField => ({
  key: "proofUrl",
  label,
  type: "url",
  required: true,
  placeholder: "URL of your profile or the post you created",
});

const fieldProofUsername: SocialField = {
  key: "proofUsername",
  label: "Your username on this platform",
  type: "text",
  required: true,
  placeholder: "@yourhandle",
};

const fieldComment = (label = "Comment template"): SocialField => ({
  key: "commentTemplate",
  label,
  type: "textarea",
  required: true,
  placeholder: "Suggested comment text (users will copy and post this)",
  helperText: "Or toggle 'Use AI prompt' to let users generate the comment with AI.",
});

const fieldWatchSeconds: SocialField = {
  key: "minWatchSeconds",
  label: "Minimum watch time (seconds)",
  type: "number",
  required: true,
  placeholder: "30",
};

const fieldImageUrl: SocialField = {
  key: "imageUrl",
  label: "Image URL (optional)",
  type: "image-url",
  required: false,
  placeholder: "Image users should attach to their post",
};

const fieldNotes: SocialField = {
  key: "notes",
  label: "Notes (optional)",
  type: "textarea",
  required: false,
  placeholder: "Any extra details for the reviewer",
};

// -----------------------------------------------------------------------------
// Platform definitions
// -----------------------------------------------------------------------------

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  // ── Facebook ─────────────────────────────────────────────────────────────
  {
    key: "FACEBOOK",
    label: "Facebook",
    emoji: "📘",
    brandColor: "bg-[#1877f2] text-white",
    websiteUrl: "https://www.facebook.com",
    actions: [
      {
        key: "FOLLOW_PAGE",
        label: "Follow Page",
        emoji: "👥",
        description: "Follow a Facebook page",
        adminFields: [fieldUrl("targetUrl", "Page URL")],
        proofFields: [fieldProofUrl("Your profile URL"), fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 25 },
      },
      {
        key: "LIKE_PAGE",
        label: "Like Page",
        emoji: "👍",
        description: "Like a Facebook page",
        adminFields: [fieldUrl("targetUrl", "Page URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
      {
        key: "LIKE_POST",
        label: "Like Post",
        emoji: "❤️",
        description: "Like a specific Facebook post",
        adminFields: [fieldUrl("targetUrl", "Post URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 3, max: 10 },
      },
      {
        key: "COMMENT_POST",
        label: "Comment on Post",
        emoji: "💬",
        description: "Leave a comment on a specific post",
        adminFields: [fieldUrl("targetUrl", "Post URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldUrl("proofUrl", "URL of your comment"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "SHARE_POST",
        label: "Share Post",
        emoji: "🔁",
        description: "Share a post publicly",
        adminFields: [fieldUrl("targetUrl", "Post URL")],
        proofFields: [fieldUrl("proofUrl", "URL of your share"), fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "CREATE_POST",
        label: "Create Post",
        emoji: "✍️",
        description: "Create and publish a new Facebook post",
        adminFields: [
          {
            key: "postContent",
            label: "Post content (template)",
            type: "textarea",
            required: true,
            placeholder: "Suggested post text with hashtags",
            helperText: "Or toggle AI prompt to let users generate.",
          },
          fieldImageUrl,
        ],
        aiGeneratableFields: ["postContent"],
        proofFields: [fieldUrl("proofUrl", "URL of your post"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 25, max: 80 },
      },
    ],
  },

  // ── Facebook Group ───────────────────────────────────────────────────────
  {
    key: "FB_GROUP",
    label: "FB Group",
    emoji: "👥",
    brandColor: "bg-[#1877f2]/80 text-white",
    websiteUrl: "https://www.facebook.com/groups",
    actions: [
      {
        key: "JOIN_GROUP",
        label: "Join Group",
        emoji: "✅",
        description: "Request to join a Facebook group",
        adminFields: [fieldUrl("targetUrl", "Group URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 40 },
      },
      {
        key: "POST_IN_GROUP",
        label: "Post in Group",
        emoji: "📝",
        description: "Create a post inside the group",
        adminFields: [
          fieldUrl("targetUrl", "Group URL"),
          {
            key: "postContent",
            label: "Post content (template)",
            type: "textarea",
            required: true,
            placeholder: "Post text users should publish",
          },
          fieldImageUrl,
        ],
        aiGeneratableFields: ["postContent"],
        proofFields: [fieldUrl("proofUrl", "URL of your post"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 30, max: 100 },
      },
      {
        key: "COMMENT_IN_GROUP",
        label: "Comment in Group",
        emoji: "💬",
        description: "Comment on a post inside the group",
        adminFields: [fieldUrl("targetUrl", "Post URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 30 },
      },
    ],
  },

  // ── Twitter/X ────────────────────────────────────────────────────────────
  {
    key: "TWITTER",
    label: "X (Twitter)",
    emoji: "𝕏",
    brandColor: "bg-black text-white",
    websiteUrl: "https://x.com",
    actions: [
      {
        key: "FOLLOW",
        label: "Follow",
        emoji: "👥",
        description: "Follow an account on X",
        adminFields: [fieldHandle("targetHandle", "Account handle")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
      {
        key: "LIKE_TWEET",
        label: "Like Tweet",
        emoji: "❤️",
        description: "Like a specific tweet",
        adminFields: [fieldUrl("targetUrl", "Tweet URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 3, max: 10 },
      },
      {
        key: "RETWEET",
        label: "Retweet",
        emoji: "🔁",
        description: "Retweet a tweet to your followers",
        adminFields: [fieldUrl("targetUrl", "Tweet URL")],
        proofFields: [fieldUrl("proofUrl", "Your retweet URL"), fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "REPLY",
        label: "Reply to Tweet",
        emoji: "💬",
        description: "Reply to a specific tweet",
        adminFields: [fieldUrl("targetUrl", "Tweet URL"), fieldComment("Reply text (template)")],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldUrl("proofUrl", "Your reply URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "QUOTE_TWEET",
        label: "Quote Tweet",
        emoji: "💭",
        description: "Quote a tweet with your own commentary",
        adminFields: [
          fieldUrl("targetUrl", "Tweet URL to quote"),
          {
            key: "quoteText",
            label: "Quote text (template)",
            type: "textarea",
            required: true,
            placeholder: "Your quote tweet content",
          },
        ],
        aiGeneratableFields: ["quoteText"],
        proofFields: [fieldUrl("proofUrl", "Your quote tweet URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 15, max: 40 },
      },
      {
        key: "POST_TWEET",
        label: "Post Tweet",
        emoji: "✍️",
        description: "Create and publish a new tweet",
        adminFields: [
          {
            key: "tweetContent",
            label: "Tweet content (template)",
            type: "textarea",
            required: true,
            placeholder: "Tweet text with hashtags (max 280 chars)",
            helperText: "Or use AI prompt to let users generate the tweet.",
          },
          {
            key: "hashtags",
            label: "Required hashtags",
            type: "text",
            required: false,
            placeholder: "#example #required",
          },
        ],
        aiGeneratableFields: ["tweetContent"],
        proofFields: [fieldUrl("proofUrl", "Your tweet URL")],
        supportsAiPrompt: true,
        suggestedReward: { min: 20, max: 60 },
      },
    ],
  },

  // ── YouTube ───────────────────────────────────────────────────────────────
  {
    key: "YOUTUBE",
    label: "YouTube",
    emoji: "▶️",
    brandColor: "bg-[#ff0000] text-white",
    websiteUrl: "https://www.youtube.com",
    actions: [
      {
        key: "SUBSCRIBE",
        label: "Subscribe to Channel",
        emoji: "🔔",
        description: "Subscribe to a YouTube channel",
        adminFields: [fieldUrl("targetUrl", "Channel URL")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "LIKE_VIDEO",
        label: "Like Video",
        emoji: "👍",
        description: "Like a specific video",
        adminFields: [fieldUrl("targetUrl", "Video URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "COMMENT_VIDEO",
        label: "Comment on Video",
        emoji: "💬",
        description: "Leave a comment on a video",
        adminFields: [fieldUrl("targetUrl", "Video URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldUrl("proofUrl", "URL of your comment"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "WATCH_VIDEO",
        label: "Watch Video",
        emoji: "👁️",
        description: "Watch a video for a minimum duration",
        adminFields: [fieldUrl("targetUrl", "Video URL"), fieldWatchSeconds],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 50 },
      },
      {
        key: "SHARE_VIDEO",
        label: "Share Video",
        emoji: "🔁",
        description: "Share a video link publicly",
        adminFields: [fieldUrl("targetUrl", "Video URL")],
        proofFields: [fieldUrl("proofUrl", "Where you shared it"), fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 30 },
      },
    ],
  },

  // ── Instagram ─────────────────────────────────────────────────────────────
  {
    key: "INSTAGRAM",
    label: "Instagram",
    emoji: "📷",
    brandColor:
      "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white",
    websiteUrl: "https://www.instagram.com",
    actions: [
      {
        key: "FOLLOW",
        label: "Follow Profile",
        emoji: "👥",
        description: "Follow an Instagram account",
        adminFields: [fieldHandle("targetHandle", "Profile handle")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 25 },
      },
      {
        key: "LIKE_POST",
        label: "Like Post",
        emoji: "❤️",
        description: "Like a specific post or reel",
        adminFields: [fieldUrl("targetUrl", "Post / Reel URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 3, max: 10 },
      },
      {
        key: "COMMENT_POST",
        label: "Comment on Post",
        emoji: "💬",
        description: "Comment on a specific post or reel",
        adminFields: [fieldUrl("targetUrl", "Post / Reel URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "SHARE_TO_STORY",
        label: "Share to Story",
        emoji: "📲",
        description: "Repost a post to your story",
        adminFields: [fieldUrl("targetUrl", "Post / Reel URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "POST_PHOTO",
        label: "Post Photo",
        emoji: "📸",
        description: "Create a feed photo post",
        adminFields: [
          {
            key: "caption",
            label: "Caption (template)",
            type: "textarea",
            required: true,
            placeholder: "Caption text with hashtags",
          },
          fieldImageUrl,
        ],
        aiGeneratableFields: ["caption"],
        proofFields: [fieldUrl("proofUrl", "Your post URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 30, max: 100 },
      },
      {
        key: "POST_REEL",
        label: "Post Reel",
        emoji: "🎬",
        description: "Create and post a Reel",
        adminFields: [
          {
            key: "caption",
            label: "Caption (template)",
            type: "textarea",
            required: true,
          },
        ],
        aiGeneratableFields: ["caption"],
        proofFields: [fieldUrl("proofUrl", "Your Reel URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 50, max: 150 },
      },
      {
        key: "POST_STORY",
        label: "Post Story",
        emoji: "📲",
        description: "Post to your Instagram story",
        adminFields: [
          {
            key: "storyText",
            label: "Story text / instructions",
            type: "textarea",
            required: false,
          },
          fieldImageUrl,
        ],
        aiGeneratableFields: ["storyText"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 15, max: 40 },
      },
    ],
  },

  // ── TikTok ────────────────────────────────────────────────────────────────
  {
    key: "TIKTOK",
    label: "TikTok",
    emoji: "🎵",
    brandColor: "bg-black text-white",
    websiteUrl: "https://www.tiktok.com",
    actions: [
      {
        key: "FOLLOW",
        label: "Follow",
        emoji: "👥",
        description: "Follow a TikTok creator",
        adminFields: [fieldHandle("targetHandle", "Creator handle")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
      {
        key: "LIKE_VIDEO",
        label: "Like Video",
        emoji: "❤️",
        description: "Like a TikTok video",
        adminFields: [fieldUrl("targetUrl", "Video URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 3, max: 10 },
      },
      {
        key: "COMMENT_VIDEO",
        label: "Comment on Video",
        emoji: "💬",
        description: "Leave a comment on a video",
        adminFields: [fieldUrl("targetUrl", "Video URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "WATCH_VIDEO",
        label: "Watch Video",
        emoji: "👁️",
        description: "Watch a video to completion",
        adminFields: [fieldUrl("targetUrl", "Video URL"), fieldWatchSeconds],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 25 },
      },
      {
        key: "POST_VIDEO",
        label: "Post Video",
        emoji: "🎬",
        description: "Post a TikTok video",
        adminFields: [
          {
            key: "caption",
            label: "Caption (template)",
            type: "textarea",
            required: true,
          },
        ],
        aiGeneratableFields: ["caption"],
        proofFields: [fieldUrl("proofUrl", "Your TikTok URL")],
        supportsAiPrompt: true,
        suggestedReward: { min: 50, max: 150 },
      },
      {
        key: "DUET_OR_STITCH",
        label: "Duet / Stitch Video",
        emoji: "🎭",
        description: "Create a duet or stitch with the original",
        adminFields: [
          fieldUrl("targetUrl", "Original video URL"),
          {
            key: "instructions",
            label: "Instructions (template)",
            type: "textarea",
            required: false,
          },
        ],
        aiGeneratableFields: ["instructions"],
        proofFields: [fieldUrl("proofUrl", "Your duet/stitch URL")],
        supportsAiPrompt: true,
        suggestedReward: { min: 40, max: 120 },
      },
    ],
  },

  // ── Pinterest ─────────────────────────────────────────────────────────────
  {
    key: "PINTEREST",
    label: "Pinterest",
    emoji: "📌",
    brandColor: "bg-[#e60023] text-white",
    websiteUrl: "https://www.pinterest.com",
    actions: [
      {
        key: "FOLLOW_PROFILE",
        label: "Follow Profile",
        emoji: "👥",
        description: "Follow a Pinterest profile",
        adminFields: [fieldUrl("targetUrl", "Profile URL")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
      {
        key: "FOLLOW_BOARD",
        label: "Follow Board",
        emoji: "📋",
        description: "Follow a specific board",
        adminFields: [fieldUrl("targetUrl", "Board URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
      {
        key: "LIKE_PIN",
        label: "Like Pin",
        emoji: "❤️",
        description: "Like (react to) a pin",
        adminFields: [fieldUrl("targetUrl", "Pin URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 3, max: 10 },
      },
      {
        key: "SAVE_PIN",
        label: "Save Pin",
        emoji: "💾",
        description: "Save a pin to one of your boards",
        adminFields: [
          fieldUrl("targetUrl", "Pin URL"),
          {
            key: "boardName",
            label: "Suggested board name",
            type: "text",
            required: false,
            placeholder: "e.g. 'Home decor'",
          },
        ],
        proofFields: [
          {
            key: "savedToBoard",
            label: "Board you saved to",
            type: "text",
            required: true,
          },
          fieldScreenshot,
        ],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "COMMENT_PIN",
        label: "Comment on Pin",
        emoji: "💬",
        description: "Leave a comment on a pin",
        adminFields: [fieldUrl("targetUrl", "Pin URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "CREATE_PIN",
        label: "Create Pin",
        emoji: "✨",
        description: "Create and publish a brand-new pin",
        adminFields: [
          {
            key: "pinTitle",
            label: "Pin title (template)",
            type: "text",
            required: true,
            placeholder: "Eye-catching pin title",
          },
          {
            key: "pinDescription",
            label: "Pin description (template)",
            type: "textarea",
            required: true,
            placeholder: "Detailed description with keywords",
          },
          fieldUrl("destinationUrl", "Destination URL the pin should link to"),
          {
            key: "boardName",
            label: "Suggested board name",
            type: "text",
            required: false,
          },
          fieldImageUrl,
        ],
        aiGeneratableFields: ["pinTitle", "pinDescription"],
        proofFields: [fieldUrl("proofUrl", "Your pin URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 40, max: 120 },
      },
      {
        key: "REPIN",
        label: "Repin",
        emoji: "🔁",
        description: "Repin an existing pin to a board",
        adminFields: [fieldUrl("targetUrl", "Pin URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
    ],
  },

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  {
    key: "LINKEDIN",
    label: "LinkedIn",
    emoji: "💼",
    brandColor: "bg-[#0a66c2] text-white",
    websiteUrl: "https://www.linkedin.com",
    actions: [
      {
        key: "FOLLOW_PROFILE",
        label: "Follow Profile",
        emoji: "👥",
        description: "Follow a LinkedIn member",
        adminFields: [fieldUrl("targetUrl", "Profile URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "FOLLOW_COMPANY",
        label: "Follow Company",
        emoji: "🏢",
        description: "Follow a LinkedIn company page",
        adminFields: [fieldUrl("targetUrl", "Company URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "LIKE_POST",
        label: "Like Post",
        emoji: "👍",
        description: "React to a post",
        adminFields: [fieldUrl("targetUrl", "Post URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "COMMENT_POST",
        label: "Comment on Post",
        emoji: "💬",
        description: "Leave a thoughtful comment",
        adminFields: [fieldUrl("targetUrl", "Post URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 15, max: 40 },
      },
      {
        key: "SHARE_POST",
        label: "Share Post",
        emoji: "🔁",
        description: "Repost / share a post",
        adminFields: [
          fieldUrl("targetUrl", "Post URL"),
          {
            key: "shareCaption",
            label: "Caption template (optional)",
            type: "textarea",
            required: false,
          },
        ],
        aiGeneratableFields: ["shareCaption"],
        proofFields: [fieldUrl("proofUrl", "Your share URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 15, max: 40 },
      },
      {
        key: "CONNECT",
        label: "Send Connection",
        emoji: "🤝",
        description: "Send a connection request",
        adminFields: [fieldUrl("targetUrl", "Profile URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "POST_ARTICLE",
        label: "Post / Article",
        emoji: "✍️",
        description: "Publish a post or article",
        adminFields: [
          {
            key: "title",
            label: "Title (template)",
            type: "text",
            required: false,
          },
          {
            key: "body",
            label: "Body (template)",
            type: "textarea",
            required: true,
          },
        ],
        aiGeneratableFields: ["title", "body"],
        proofFields: [fieldUrl("proofUrl", "Your post URL")],
        supportsAiPrompt: true,
        suggestedReward: { min: 50, max: 150 },
      },
    ],
  },

  // ── Threads ───────────────────────────────────────────────────────────────
  {
    key: "THREADS",
    label: "Threads",
    emoji: "🧵",
    brandColor: "bg-black text-white border border-gray-700",
    websiteUrl: "https://www.threads.net",
    actions: [
      {
        key: "FOLLOW",
        label: "Follow",
        emoji: "👥",
        description: "Follow a Threads account",
        adminFields: [fieldHandle("targetHandle", "Account handle")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
      {
        key: "LIKE_POST",
        label: "Like Post",
        emoji: "❤️",
        description: "Like a thread",
        adminFields: [fieldUrl("targetUrl", "Thread URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 3, max: 10 },
      },
      {
        key: "REPLY",
        label: "Reply to Thread",
        emoji: "💬",
        description: "Reply to a thread",
        adminFields: [fieldUrl("targetUrl", "Thread URL"), fieldComment("Reply (template)")],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldUrl("proofUrl", "Your reply URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "REPOST",
        label: "Repost",
        emoji: "🔁",
        description: "Repost a thread",
        adminFields: [fieldUrl("targetUrl", "Thread URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "POST_THREAD",
        label: "Post Thread",
        emoji: "✍️",
        description: "Create a new thread",
        adminFields: [
          {
            key: "threadContent",
            label: "Thread content (template)",
            type: "textarea",
            required: true,
          },
        ],
        aiGeneratableFields: ["threadContent"],
        proofFields: [fieldUrl("proofUrl", "Your thread URL")],
        supportsAiPrompt: true,
        suggestedReward: { min: 25, max: 80 },
      },
    ],
  },

  // ── Discord ───────────────────────────────────────────────────────────────
  {
    key: "DISCORD",
    label: "Discord",
    emoji: "💬",
    brandColor: "bg-[#5865f2] text-white",
    websiteUrl: "https://discord.com",
    actions: [
      {
        key: "JOIN_SERVER",
        label: "Join Server",
        emoji: "✅",
        description: "Accept a Discord server invite",
        adminFields: [fieldUrl("targetUrl", "Invite URL")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 30 },
      },
      {
        key: "POST_IN_CHANNEL",
        label: "Post in Channel",
        emoji: "📝",
        description: "Send a message in a channel",
        adminFields: [
          fieldUrl("targetUrl", "Server invite or channel URL"),
          {
            key: "channelName",
            label: "Channel name",
            type: "text",
            required: true,
            placeholder: "#general",
          },
          {
            key: "messageContent",
            label: "Message content (template)",
            type: "textarea",
            required: true,
          },
        ],
        aiGeneratableFields: ["messageContent"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 15, max: 40 },
      },
      {
        key: "REACT_TO_MESSAGE",
        label: "React to Message",
        emoji: "🎉",
        description: "Add an emoji reaction to a message",
        adminFields: [
          fieldUrl("targetUrl", "Message URL"),
          {
            key: "emoji",
            label: "Emoji to react with",
            type: "text",
            required: true,
            placeholder: "🎉",
          },
        ],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
    ],
  },

  // ── Telegram ──────────────────────────────────────────────────────────────
  {
    key: "TELEGRAM",
    label: "Telegram",
    emoji: "✈️",
    brandColor: "bg-[#0088cc] text-white",
    websiteUrl: "https://telegram.org",
    actions: [
      {
        key: "JOIN_CHANNEL",
        label: "Join Channel",
        emoji: "📢",
        description: "Join a Telegram channel",
        adminFields: [fieldUrl("targetUrl", "Channel URL (t.me/...)")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "JOIN_GROUP",
        label: "Join Group",
        emoji: "👥",
        description: "Join a Telegram group",
        adminFields: [fieldUrl("targetUrl", "Group URL")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "VOTE_IN_POLL",
        label: "Vote in Poll",
        emoji: "🗳️",
        description: "Vote in a Telegram poll",
        adminFields: [
          fieldUrl("targetUrl", "Poll / message URL"),
          {
            key: "voteOption",
            label: "Option to vote for",
            type: "text",
            required: false,
          },
        ],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "FORWARD_MESSAGE",
        label: "Forward Message",
        emoji: "🔁",
        description: "Forward a message to your contacts",
        adminFields: [fieldUrl("targetUrl", "Message URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "POST_IN_GROUP",
        label: "Post in Group",
        emoji: "📝",
        description: "Send a message in a Telegram group",
        adminFields: [
          fieldUrl("targetUrl", "Group URL"),
          {
            key: "messageContent",
            label: "Message content (template)",
            type: "textarea",
            required: true,
          },
        ],
        aiGeneratableFields: ["messageContent"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 15, max: 40 },
      },
    ],
  },

  // ── Reddit ────────────────────────────────────────────────────────────────
  {
    key: "REDDIT",
    label: "Reddit",
    emoji: "🤖",
    brandColor: "bg-[#ff4500] text-white",
    websiteUrl: "https://www.reddit.com",
    actions: [
      {
        key: "JOIN_SUBREDDIT",
        label: "Join Subreddit",
        emoji: "✅",
        description: "Subscribe to a subreddit",
        adminFields: [fieldUrl("targetUrl", "Subreddit URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "UPVOTE_POST",
        label: "Upvote Post",
        emoji: "⬆️",
        description: "Upvote a post or comment",
        adminFields: [fieldUrl("targetUrl", "Post URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 3, max: 10 },
      },
      {
        key: "COMMENT_POST",
        label: "Comment on Post",
        emoji: "💬",
        description: "Leave a comment on a Reddit post",
        adminFields: [fieldUrl("targetUrl", "Post URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldUrl("proofUrl", "Your comment URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 15, max: 40 },
      },
      {
        key: "SUBMIT_POST",
        label: "Submit Post",
        emoji: "📝",
        description: "Submit a new post to a subreddit",
        adminFields: [
          {
            key: "subreddit",
            label: "Subreddit (e.g. r/example)",
            type: "text",
            required: true,
            placeholder: "r/example",
          },
          {
            key: "postTitle",
            label: "Post title (template)",
            type: "text",
            required: true,
          },
          {
            key: "postBody",
            label: "Post body (template)",
            type: "textarea",
            required: true,
          },
        ],
        aiGeneratableFields: ["postTitle", "postBody"],
        proofFields: [fieldUrl("proofUrl", "Your post URL"), fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 40, max: 120 },
      },
    ],
  },

  // ── Spotify ───────────────────────────────────────────────────────────────
  {
    key: "SPOTIFY",
    label: "Spotify",
    emoji: "🎧",
    brandColor: "bg-[#1db954] text-white",
    websiteUrl: "https://open.spotify.com",
    actions: [
      {
        key: "FOLLOW_ARTIST",
        label: "Follow Artist",
        emoji: "🎤",
        description: "Follow a Spotify artist",
        adminFields: [fieldUrl("targetUrl", "Artist URL")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "FOLLOW_PLAYLIST",
        label: "Follow Playlist",
        emoji: "📂",
        description: "Follow a public playlist",
        adminFields: [fieldUrl("targetUrl", "Playlist URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "LIKE_TRACK",
        label: "Like Track",
        emoji: "❤️",
        description: "Add a track to liked songs",
        adminFields: [fieldUrl("targetUrl", "Track URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "ADD_TO_PLAYLIST",
        label: "Add to Playlist",
        emoji: "📌",
        description: "Add a track to one of your playlists",
        adminFields: [fieldUrl("targetUrl", "Track URL")],
        proofFields: [
          {
            key: "playlistName",
            label: "Playlist name",
            type: "text",
            required: true,
          },
          fieldScreenshot,
        ],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "LISTEN_FULL",
        label: "Listen Full Track",
        emoji: "🎶",
        description: "Listen to a track in full",
        adminFields: [fieldUrl("targetUrl", "Track URL"), fieldWatchSeconds],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
    ],
  },

  // ── SoundCloud ────────────────────────────────────────────────────────────
  {
    key: "SOUNDCLOUD",
    label: "SoundCloud",
    emoji: "☁️",
    brandColor: "bg-[#ff5500] text-white",
    websiteUrl: "https://soundcloud.com",
    actions: [
      {
        key: "FOLLOW",
        label: "Follow",
        emoji: "👥",
        description: "Follow a SoundCloud profile",
        adminFields: [fieldUrl("targetUrl", "Profile URL")],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "LIKE_TRACK",
        label: "Like Track",
        emoji: "❤️",
        description: "Like a track",
        adminFields: [fieldUrl("targetUrl", "Track URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "REPOST",
        label: "Repost",
        emoji: "🔁",
        description: "Repost a track to your followers",
        adminFields: [fieldUrl("targetUrl", "Track URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "COMMENT",
        label: "Comment",
        emoji: "💬",
        description: "Comment on a track",
        adminFields: [fieldUrl("targetUrl", "Track URL"), fieldComment()],
        aiGeneratableFields: ["commentTemplate"],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: true,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "LISTEN_FULL",
        label: "Listen Full Track",
        emoji: "🎶",
        description: "Listen to a track in full",
        adminFields: [fieldUrl("targetUrl", "Track URL"), fieldWatchSeconds],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 20 },
      },
    ],
  },

  // ── Snapchat ──────────────────────────────────────────────────────────────
  {
    key: "SNAPCHAT",
    label: "Snapchat",
    emoji: "👻",
    brandColor: "bg-[#fffc00] text-black",
    websiteUrl: "https://www.snapchat.com",
    actions: [
      {
        key: "FOLLOW",
        label: "Follow",
        emoji: "👥",
        description: "Follow a Snapchat user",
        adminFields: [
          {
            key: "targetHandle",
            label: "Username or snapcode URL",
            type: "text",
            required: true,
            placeholder: "@username",
          },
        ],
        proofFields: [fieldProofUsername, fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "ADD_FRIEND",
        label: "Add Friend",
        emoji: "🤝",
        description: "Add as friend",
        adminFields: [
          {
            key: "targetHandle",
            label: "Username",
            type: "text",
            required: true,
          },
        ],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
      {
        key: "VIEW_STORY",
        label: "View Story",
        emoji: "👁️",
        description: "View a public story",
        adminFields: [fieldUrl("targetUrl", "Story URL or snapcode")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 5, max: 15 },
      },
      {
        key: "SUBSCRIBE_PUBLIC",
        label: "Subscribe (Public)",
        emoji: "🔔",
        description: "Subscribe to a public profile",
        adminFields: [fieldUrl("targetUrl", "Public profile URL")],
        proofFields: [fieldScreenshot],
        supportsAiPrompt: false,
        suggestedReward: { min: 10, max: 25 },
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function getPlatform(key: string | null | undefined): SocialPlatform | undefined {
  return SOCIAL_PLATFORMS.find((p) => p.key === key);
}

export function getAction(
  platformKey: string | null | undefined,
  actionKey: string | null | undefined
): SocialAction | undefined {
  const platform = getPlatform(platformKey);
  if (!platform) return undefined;
  return platform.actions.find((a) => a.key === actionKey);
}

/** Get a fresh empty SocialConfig for a new task */
export function emptySocialConfig(): SocialConfig {
  return {
    platform: null,
    action: null,
    fields: {},
    aiPromptEnabled: false,
    aiPrompt: null,
    proofRequirements: { url: true, screenshot: true, username: false },
  };
}

/**
 * Persisted shape stored in Task.socialConfig (JSON).
 * Keep this stable — read from user-side and admin-side.
 */
export interface SocialConfig {
  platform: string | null;
  action: string | null;
  /** Values for adminFields, keyed by field.key */
  fields: Record<string, string>;
  /** When true, AI-generatable admin fields are replaced by `aiPrompt` */
  aiPromptEnabled: boolean;
  aiPrompt: string | null;
  /** Computed/overridden proof requirements (from action def or admin override) */
  proofRequirements: {
    url: boolean;
    screenshot: boolean;
    username: boolean;
  };
}

/** Common proof-type label used across the user-side UI */
export type ProofType = "URL" | "SCREENSHOT" | "BOTH" | "USERNAME";

export function deriveProofType(cfg: SocialConfig): ProofType {
  const { url, screenshot, username } = cfg.proofRequirements;
  if (username) return "USERNAME";
  if (url && screenshot) return "BOTH";
  if (url) return "URL";
  if (screenshot) return "SCREENSHOT";
  return "BOTH";
}
