// Media Library Types

export interface MediaItem {
  id: string;
  filename: string;
  originalFilename: string;
  fileType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "OTHER";
  mimeType: string;
  fileSize: number;
  s3Key: string;
  s3Url: string;
  cloudFrontUrl?: string;
  altText?: string;
  caption?: string;
  description?: string;
  width?: number;
  height?: number;
  duration?: number; // for videos/audio in seconds
  uploadedById: string;
  uploadedBy?: {
    id: string;
    name?: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Upload Progress Types
export interface UploadProgress {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  error?: string;
  mediaItem?: MediaItem;
}

// Media Library Filter Options
export interface MediaFilter {
  fileType?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "OTHER" | "all";
  search?: string;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// Media Library Response
export interface MediaLibraryResponse {
  items: MediaItem[];
  total: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

// Media Selection Props (for WordPress-style picker)
export interface MediaSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem | MediaItem[]) => void;
  multiple?: boolean;
  fileType?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "all";
  title?: string;
  maxFileSize?: number; // in bytes
  allowedTypes?: string[]; // MIME types
}

// Media Upload Props
export interface MediaUploaderProps {
  onUploadComplete?: (mediaItems: MediaItem[]) => void;
  onUploadError?: (error: string) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  className?: string;
}

// Media Item Update Data
export interface MediaUpdateData {
  altText?: string;
  caption?: string;
  description?: string;
}

// S3 Upload Result
export interface S3UploadResult {
  s3Url: string;
  cloudFrontUrl?: string;
  s3Key: string;
  success: boolean;
  error?: string;
}

// File Validation Result
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "OTHER";
}

// Upload Config for multipart uploads
export interface UploadConfig {
  regularEndpoint: string;
  initiateEndpoint: string;
  completeEndpoint: string;
}

// Upload Options
export interface UploadOptions {
  onProgress?: (progress: number) => void;
  extraFields?: Record<string, string>;
}

// Upload Result
export interface UploadResult {
  success: boolean;
  url?: string;
  s3Key?: string;
  filename?: string;
  fileType?: string;
  fileSize?: number;
  error?: string;
  mediaItem?: MediaItem;
}
