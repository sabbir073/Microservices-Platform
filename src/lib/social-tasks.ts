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

// Reserved: optional notes field that platforms can opt into.
const _fieldNotes: SocialField = {
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
      "bg-linear-to-br from-purple-500 via-pink-500 to-orange-400 text-white",
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
// Catalog enrichment (additive) — extra actions merged into the platforms above.
// Kept here (rather than inline) so the merge is easy to audit. Every new action
// key also has an ACTION_TIER entry so ordering + validation keep working.
// -----------------------------------------------------------------------------

const fieldDurationDays: SocialField = {
  key: "durationDays",
  label: "Keep live (days)",
  type: "number",
  required: false,
  placeholder: "7",
};

const ta = (key: string, label: string, required = false, placeholder?: string): SocialField => ({
  key,
  label,
  type: "textarea",
  required,
  placeholder,
});

const txt = (key: string, label: string, required = false, placeholder?: string): SocialField => ({
  key,
  label,
  type: "text",
  required,
  placeholder,
});

const EXTRA_ACTIONS: Record<string, SocialAction[]> = {
  FACEBOOK: [
    {
      key: "SAVE_POST",
      label: "Save Post",
      emoji: "🔖",
      description: "Save a post to your collection",
      adminFields: [fieldUrl("targetUrl", "Post URL")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 2, max: 10 },
    },
    {
      key: "WATCH_REEL",
      label: "Watch Reel",
      emoji: "🎬",
      description: "Watch a reel for a minimum duration",
      adminFields: [fieldUrl("targetUrl", "Reel URL"), fieldWatchSeconds],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 3, max: 15 },
    },
    {
      key: "CREATE_STORY",
      label: "Create Story",
      emoji: "🌟",
      description: "Post a 24-hour story",
      adminFields: [fieldImageUrl, ta("storyText", "Story text", false, "Text overlay")],
      aiGeneratableFields: ["storyText"],
      proofFields: [fieldProofUrl("Story link"), fieldScreenshot],
      supportsAiPrompt: true,
      suggestedReward: { min: 4, max: 20 },
    },
    {
      key: "CROSS_POST_PAGES",
      label: "Cross-Post to Pages",
      emoji: "📣",
      description: "Share a post across multiple pages",
      adminFields: [ta("pageList", "Page list", true, "One page URL per line"), txt("shareCaption", "Share caption")],
      proofFields: [fieldProofUrl("Link to one share"), fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 10, max: 30 },
    },
    {
      key: "KEEP_POST_LIVE",
      label: "Keep Post Live",
      emoji: "⏳",
      description: "Keep a post public for N+ days",
      adminFields: [fieldUrl("targetUrl", "Post URL"), fieldDurationDays],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 5, max: 15 },
    },
  ],
  INSTAGRAM: [
    {
      key: "SAVE_POST",
      label: "Save Post",
      emoji: "🔖",
      description: "Save a post",
      adminFields: [fieldUrl("targetUrl", "Post URL")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 2, max: 8 },
    },
    {
      key: "CREATE_STORY",
      label: "Create Story",
      emoji: "🌟",
      description: "Post a 24-hour story",
      adminFields: [fieldImageUrl, ta("storyText", "Story text", false, "Text overlay"), txt("tagHandle", "Tag handle")],
      aiGeneratableFields: ["storyText"],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: true,
      suggestedReward: { min: 6, max: 20 },
    },
    {
      key: "KEEP_POST_LIVE",
      label: "Keep Post Live",
      emoji: "⏳",
      description: "Keep a post public for N+ days",
      adminFields: [fieldUrl("targetUrl", "Post URL"), fieldDurationDays],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 5, max: 15 },
    },
  ],
  YOUTUBE: [
    {
      key: "TURN_ON_BELL",
      label: "Turn On Notifications",
      emoji: "🔔",
      description: "Enable the notification bell on a channel",
      adminFields: [fieldUrl("targetUrl", "Channel URL")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 2, max: 8 },
    },
    {
      key: "CREATE_SHORT",
      label: "Create Short",
      emoji: "📱",
      description: "Create a YouTube Short",
      adminFields: [txt("title", "Title", true), ta("description", "Description", true), txt("hashtags", "Hashtags")],
      aiGeneratableFields: ["description"],
      proofFields: [fieldProofUrl("Short URL"), fieldScreenshot],
      supportsAiPrompt: true,
      suggestedReward: { min: 20, max: 60 },
    },
    {
      key: "CREATE_COMMUNITY_POST",
      label: "Create Community Post",
      emoji: "📝",
      description: "Post to the channel community tab",
      adminFields: [ta("postText", "Post text", true), fieldImageUrl],
      aiGeneratableFields: ["postText"],
      proofFields: [fieldProofUrl("Post URL"), fieldScreenshot],
      supportsAiPrompt: true,
      suggestedReward: { min: 6, max: 20 },
    },
  ],
  TWITTER: [
    {
      key: "BOOKMARK_TWEET",
      label: "Bookmark Tweet",
      emoji: "🔖",
      description: "Bookmark a tweet",
      adminFields: [fieldUrl("targetUrl", "Tweet URL")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 2, max: 8 },
    },
    {
      key: "CREATE_THREAD",
      label: "Create Thread",
      emoji: "🧵",
      description: "Post a thread of 3+ tweets",
      adminFields: [ta("threadText", "Thread content", true, "One tweet per line"), txt("hashtags", "Hashtags")],
      aiGeneratableFields: ["threadText"],
      proofFields: [fieldProofUrl("Thread URL"), fieldScreenshot],
      supportsAiPrompt: true,
      suggestedReward: { min: 15, max: 40 },
    },
  ],
  PINTEREST: [
    {
      key: "CREATE_BOARD",
      label: "Create Themed Board",
      emoji: "🗂️",
      description: "Create a new themed board",
      adminFields: [txt("boardName", "Board name", true), ta("boardDescription", "Board description")],
      proofFields: [fieldProofUrl("Board URL"), fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 5, max: 15 },
    },
    {
      key: "PIN_TO_MULTI",
      label: "Pin to 2+ Boards",
      emoji: "📌",
      description: "Pin to multiple boards",
      adminFields: [fieldUrl("targetUrl", "Pin URL"), ta("boardNames", "Board names", true, "One board per line")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 5, max: 15 },
    },
  ],
  LINKEDIN: [
    {
      key: "REPOST_TO_FEED",
      label: "Repost to Feed",
      emoji: "🔁",
      description: "Repost content to your feed",
      adminFields: [fieldUrl("targetUrl", "Post URL")],
      proofFields: [fieldProofUrl("Your repost URL"), fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 5, max: 15 },
    },
  ],
  TIKTOK: [
    {
      key: "SAVE_TO_FAVORITES",
      label: "Save to Favorites",
      emoji: "🔖",
      description: "Save a video to favorites",
      adminFields: [fieldUrl("targetUrl", "Video URL")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 2, max: 8 },
    },
    {
      key: "KEEP_VIDEO_LIVE",
      label: "Keep Video Live",
      emoji: "⏳",
      description: "Keep a video public for N+ days",
      adminFields: [fieldUrl("targetUrl", "Video URL"), fieldDurationDays],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 8, max: 20 },
    },
  ],
  REDDIT: [
    {
      key: "SAVE_POST",
      label: "Save Post",
      emoji: "🔖",
      description: "Save a post",
      adminFields: [fieldUrl("targetUrl", "Post URL")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 2, max: 8 },
    },
    {
      key: "FOLLOW_USER",
      label: "Follow Redditor",
      emoji: "👤",
      description: "Follow a Reddit user",
      adminFields: [fieldUrl("targetUrl", "Profile URL")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 4, max: 10 },
    },
    {
      key: "GIVE_AWARD",
      label: "Give Award",
      emoji: "🏅",
      description: "Give an award to a post",
      adminFields: [fieldUrl("targetUrl", "Post URL"), txt("awardType", "Award type")],
      proofFields: [fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 6, max: 15 },
    },
    {
      key: "CROSS_POST",
      label: "Cross-Post",
      emoji: "📣",
      description: "Cross-post to 2+ subreddits",
      adminFields: [fieldUrl("targetUrl", "Original post URL"), ta("subredditList", "Subreddit list", true, "One subreddit per line")],
      proofFields: [fieldProofUrl("Link to one cross-post"), fieldScreenshot],
      supportsAiPrompt: false,
      suggestedReward: { min: 10, max: 25 },
    },
  ],
};

// Merge the extra actions into the platform definitions (runs once at load).
for (const _platform of SOCIAL_PLATFORMS) {
  const extra = EXTRA_ACTIONS[_platform.key];
  if (extra) _platform.actions.push(...extra);
}

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

// =============================================================================
// BUNDLE MODEL (v2) — one task = one platform + an ordered bundle of actions
// -----------------------------------------------------------------------------
// The persisted shape moved from a single-action `SocialConfig` to
// `SocialBundleConfig`. Old single-action tasks are read lazily via
// `normalizeSocialConfig` (wrapped as a 1-item bundle) so nothing needs a
// backfill. `Task.pointsReward` stays the authoritative total (= Σ item points).
// =============================================================================

export interface ProofRequirements {
  url: boolean;
  screenshot: boolean;
  username: boolean;
}

/** One chosen action inside a bundle, with its own points + proof + fields. */
export interface BundleItem {
  action: string;
  /** Admin-filled values for the action's adminFields, keyed by field.key */
  fields: Record<string, string>;
  /** Per-item points (display / breakdown). Task total = Σ of these. */
  points: number;
  proofRequirements: ProofRequirements;
  aiPromptEnabled: boolean;
  aiPrompt: string | null;
  /** Display-only (e.g. min watch seconds); no lock enforcement. */
  watchSeconds?: number;
}

/** Persisted shape stored in Task.socialConfig (JSON), v2. */
export interface SocialBundleConfig {
  platform: string | null;
  items: BundleItem[];
  version: 2;
}

const DEFAULT_PROOF: ProofRequirements = {
  url: true,
  screenshot: true,
  username: false,
};

function coerceProofRequirements(raw: unknown): ProofRequirements {
  const r = (raw ?? {}) as Partial<ProofRequirements>;
  return {
    url: !!r.url,
    screenshot: !!r.screenshot,
    username: !!r.username,
  };
}

function coerceBundleItem(raw: unknown): BundleItem | null {
  const r = (raw ?? {}) as Partial<BundleItem>;
  if (!r.action || typeof r.action !== "string") return null;
  const pts = Number(r.points);
  return {
    action: r.action,
    fields:
      r.fields && typeof r.fields === "object"
        ? (r.fields as Record<string, string>)
        : {},
    points: Number.isFinite(pts) && pts > 0 ? pts : 0,
    proofRequirements: r.proofRequirements
      ? coerceProofRequirements(r.proofRequirements)
      : { ...DEFAULT_PROOF },
    aiPromptEnabled: !!r.aiPromptEnabled,
    aiPrompt: typeof r.aiPrompt === "string" ? r.aiPrompt : null,
    watchSeconds:
      typeof r.watchSeconds === "number" && Number.isFinite(r.watchSeconds)
        ? r.watchSeconds
        : undefined,
  };
}

/**
 * Read ANY stored socialConfig (null / legacy v1 single-action / v2 bundle /
 * garbage) into a normalized bundle. Never throws. Used by every read path so
 * legacy tasks and in-flight submissions keep working.
 */
export function normalizeSocialConfig(
  raw: unknown
): { platform: string | null; items: BundleItem[] } {
  if (!raw || typeof raw !== "object") return { platform: null, items: [] };
  const cfg = raw as Record<string, unknown>;

  // v2 bundle
  if (Array.isArray(cfg.items)) {
    const items = cfg.items
      .map(coerceBundleItem)
      .filter((i): i is BundleItem => i !== null);
    return {
      platform: typeof cfg.platform === "string" ? cfg.platform : null,
      items,
    };
  }

  // legacy v1 single-action → wrap as a 1-item bundle
  if (typeof cfg.action === "string" && cfg.action) {
    return {
      platform: typeof cfg.platform === "string" ? cfg.platform : null,
      items: [
        {
          action: cfg.action,
          fields:
            cfg.fields && typeof cfg.fields === "object"
              ? (cfg.fields as Record<string, string>)
              : {},
          // v1 points lived on Task.pointsReward, not in the config.
          points: 0,
          proofRequirements: coerceProofRequirements(cfg.proofRequirements),
          aiPromptEnabled: !!cfg.aiPromptEnabled,
          aiPrompt: typeof cfg.aiPrompt === "string" ? cfg.aiPrompt : null,
        },
      ],
    };
  }

  return {
    platform: typeof cfg.platform === "string" ? cfg.platform : null,
    items: [],
  };
}

/** A fresh empty bundle config for a new task. */
export function emptyBundleConfig(): SocialBundleConfig {
  return { platform: null, items: [], version: 2 };
}

// -----------------------------------------------------------------------------
// Natural-flow ordering: watch → like → save → comment → share → follow → create
// -----------------------------------------------------------------------------

const ACTION_TIER: Record<string, number> = {
  // 10 — passive consume (must be first)
  WATCH_VIDEO: 10,
  VIEW_STORY: 10,
  LISTEN_FULL: 10,
  // 20 — quick reactions
  LIKE_PAGE: 20,
  LIKE_POST: 20,
  LIKE_TWEET: 20,
  LIKE_VIDEO: 20,
  LIKE_PIN: 20,
  LIKE_TRACK: 20,
  UPVOTE_POST: 20,
  REACT_TO_MESSAGE: 20,
  VOTE_IN_POLL: 20,
  // 30 — save / add / collect
  SAVE_PIN: 30,
  ADD_TO_PLAYLIST: 30,
  FOLLOW_PLAYLIST: 30,
  FOLLOW_BOARD: 30,
  // 40 — text engagement
  COMMENT_POST: 40,
  COMMENT_VIDEO: 40,
  COMMENT_PIN: 40,
  COMMENT_IN_GROUP: 40,
  COMMENT: 40,
  REPLY: 40,
  // 50 — sharing
  SHARE_POST: 50,
  SHARE_VIDEO: 50,
  SHARE_TO_STORY: 50,
  RETWEET: 50,
  QUOTE_TWEET: 50,
  REPOST: 50,
  REPIN: 50,
  FORWARD_MESSAGE: 50,
  // 60 — follow / join / connect
  FOLLOW: 60,
  FOLLOW_PAGE: 60,
  FOLLOW_PROFILE: 60,
  FOLLOW_COMPANY: 60,
  FOLLOW_ARTIST: 60,
  SUBSCRIBE: 60,
  SUBSCRIBE_PUBLIC: 60,
  CONNECT: 60,
  ADD_FRIEND: 60,
  JOIN_GROUP: 60,
  JOIN_SERVER: 60,
  JOIN_CHANNEL: 60,
  JOIN_SUBREDDIT: 60,
  // 80 — heavy creation (last)
  CREATE_POST: 80,
  POST_PHOTO: 80,
  POST_REEL: 80,
  POST_STORY: 80,
  POST_TWEET: 80,
  POST_VIDEO: 80,
  POST_THREAD: 80,
  POST_ARTICLE: 80,
  POST_IN_GROUP: 80,
  POST_IN_CHANNEL: 80,
  SUBMIT_POST: 80,
  CREATE_PIN: 80,
  DUET_OR_STITCH: 80,
  // 95 — keep-alive commitments (always last)
  KEEP_POST_LIVE: 95,
  KEEP_VIDEO_LIVE: 95,
  // catalog-enrichment additions
  WATCH_REEL: 10,
  SAVE_POST: 30,
  SAVE_TO_FAVORITES: 30,
  BOOKMARK_TWEET: 30,
  CROSS_POST_PAGES: 50,
  CROSS_POST: 50,
  REPOST_TO_FEED: 50,
  TURN_ON_BELL: 60,
  FOLLOW_USER: 60,
  CREATE_STORY: 80,
  CREATE_SHORT: 80,
  CREATE_COMMUNITY_POST: 80,
  CREATE_THREAD: 80,
  CREATE_BOARD: 80,
  PIN_TO_MULTI: 80,
  GIVE_AWARD: 80,
};

/** Natural-flow tier for an action key (lower = earlier). Unknown → 90. */
export function actionPriority(actionKey: string): number {
  return ACTION_TIER[actionKey] ?? 90;
}

/** Watch/stream actions that can use a timed-lock player (see SocialWatchModal). */
const WATCH_ACTIONS = new Set(["WATCH_VIDEO", "LISTEN_FULL", "WATCH_REEL"]);

/** True if the action is a passive watch/stream type (eligible for a watch timer). */
export function isWatchAction(actionKey: string | null | undefined): boolean {
  return !!actionKey && WATCH_ACTIONS.has(actionKey);
}

/** Sort bundle items into the natural worker flow (stable within a tier). */
export function sortBundleItems(items: BundleItem[]): BundleItem[] {
  return [...items].sort(
    (a, b) => actionPriority(a.action) - actionPriority(b.action)
  );
}

/** Task-total points = Σ item points, floored at 0. */
export function bundleTotalPoints(items: BundleItem[]): number {
  const sum = items.reduce((acc, i) => acc + (Number(i.points) || 0), 0);
  return sum > 0 ? Math.round(sum) : 0;
}

export interface BundleValidationResult {
  ok: boolean;
  error?: string;
  /** Per-item errors keyed by item index. */
  itemErrors?: Record<number, string>;
}

/**
 * Validate a bundle: platform set, ≥1 item, each action resolves, required
 * adminFields filled (skipping AI-generatable ones when AI mode is on for the
 * item), points ≥ 0, and ≥1 proof requirement per item.
 */
export function validateSocialBundle(cfg: {
  platform: string | null;
  items: BundleItem[];
}): BundleValidationResult {
  if (!cfg.platform) return { ok: false, error: "Pick a platform." };
  if (!getPlatform(cfg.platform)) {
    return { ok: false, error: "Unknown platform." };
  }
  if (!cfg.items.length) {
    return { ok: false, error: "Add at least one action to the bundle." };
  }
  const itemErrors: Record<number, string> = {};
  cfg.items.forEach((item, idx) => {
    const def = getAction(cfg.platform, item.action);
    if (!def) {
      itemErrors[idx] = `Unknown action "${item.action}".`;
      return;
    }
    if (!(item.points >= 0) || !Number.isFinite(item.points)) {
      itemErrors[idx] = "Points must be 0 or more.";
      return;
    }
    const pr = item.proofRequirements;
    if (!pr.url && !pr.screenshot && !pr.username) {
      itemErrors[idx] = "Select at least one proof requirement.";
      return;
    }
    const aiOn = item.aiPromptEnabled && !!(item.aiPrompt ?? "").trim();
    const missing = def.adminFields.find((f) => {
      if (!f.required) return false;
      if (aiOn && def.aiGeneratableFields?.includes(f.key)) return false;
      return !(item.fields[f.key] ?? "").trim();
    });
    if (missing) {
      itemErrors[idx] = `Fill "${missing.label}" for ${def.label}.`;
    }
  });
  if (Object.keys(itemErrors).length) {
    const first = itemErrors[Number(Object.keys(itemErrors)[0])];
    return { ok: false, error: first, itemErrors };
  }
  return { ok: true };
}
