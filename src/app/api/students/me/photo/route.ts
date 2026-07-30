import { NextResponse } from "next/server";
import { Role, requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    // Authenticate & Require Student Role
    const { user, errorResponse } = await requireRole(req, [Role.STUDENT]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Profile photo is required." }, { status: 400 });
    }

    // Validate size and type
    const allowedTypes = ["image/jpeg", "image/png"];
    const maxSizeBytes = 2 * 1024 * 1024; // 2MB for profile photo

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Only JPEG and PNG are allowed.` },
        { status: 400 }
      );
    }

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File too large. Maximum file size is 2MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadFile(buffer, `profile_${user.userId}_${file.name}`, file.type);

    const updatedStudent = await prisma.student.update({
      where: { userId: user.userId },
      data: { profilePhotoUrl: fileUrl },
    });

    return NextResponse.json({
      message: "Profile photo updated successfully.",
      profilePhotoUrl: updatedStudent.profilePhotoUrl,
    });
  } catch (error: any) {
    console.error("Profile photo upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
