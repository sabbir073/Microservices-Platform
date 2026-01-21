import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import {
  completeMultipartUpload,
  abortMultipartUpload,
  getMediaUrl,
  getMediaFileType,
  isS3Configured,
} from "@/lib/s3";

// POST /api/media/upload/multipart/complete - Complete multipart upload
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.create")) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    if (!isS3Configured()) {
      return NextResponse.json({ error: "S3 not configured" }, { status: 500 });
    }

    const body = await request.json();
    const {
      uploadId,
      s3Key,
      parts,
      filename,
      originalFilename,
      fileType,
      fileSize,
    } = body;

    if (!uploadId || !s3Key || !parts || !Array.isArray(parts)) {
      return NextResponse.json(
        { error: "Missing required fields: uploadId, s3Key, parts" },
        { status: 400 }
      );
    }

    // Complete multipart upload on S3
    const completeResult = await completeMultipartUpload(s3Key, uploadId, parts);

    if (!completeResult.success || !completeResult.url) {
      return NextResponse.json(
        { error: completeResult.error || "Failed to complete upload" },
        { status: 500 }
      );
    }

    // Get URLs
    const { s3Url, cloudFrontUrl } = getMediaUrl(s3Key);

    // Get file type
    const mediaFileType = getMediaFileType(fileType);

    // Save to database
    const mediaItem = await prisma.media.create({
      data: {
        filename: filename,
        originalFilename: originalFilename,
        fileType: mediaFileType,
        mimeType: fileType,
        fileSize: fileSize,
        s3Key,
        s3Url,
        cloudFrontUrl,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      url: cloudFrontUrl || s3Url,
      s3Url,
      cloudFrontUrl,
      s3Key,
      filename,
      fileType,
      fileSize,
      mediaItem,
    });
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    return NextResponse.json(
      { error: "Failed to complete multipart upload" },
      { status: 500 }
    );
  }
}

// DELETE /api/media/upload/multipart/complete - Abort multipart upload
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.create")) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    if (!isS3Configured()) {
      return NextResponse.json({ error: "S3 not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { uploadId, s3Key } = body;

    if (!uploadId || !s3Key) {
      return NextResponse.json(
        { error: "Missing required fields: uploadId, s3Key" },
        { status: 400 }
      );
    }

    // Abort multipart upload
    const abortResult = await abortMultipartUpload(s3Key, uploadId);

    if (!abortResult.success) {
      return NextResponse.json(
        { error: abortResult.error || "Failed to abort upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Upload aborted successfully",
    });
  } catch (error) {
    console.error("Error aborting multipart upload:", error);
    return NextResponse.json(
      { error: "Failed to abort multipart upload" },
      { status: 500 }
    );
  }
}
