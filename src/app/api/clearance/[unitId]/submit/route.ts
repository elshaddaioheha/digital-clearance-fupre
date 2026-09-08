import { NextResponse } from "next/server";
import crypto from "crypto";
import { Role, ClearanceStatus } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  req: Request,
  props: { params: Promise<{ unitId: string }> }
) {
  try {
    // 1. Resolve parameters
    const { unitId } = await props.params;

    // 2. Authenticate & Require Student Role
    const { user, errorResponse } = await requireRole(req, [Role.STUDENT]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Find/Validate Clearing Unit & Clearance Request
    const unit = await prisma.clearingUnit.findUnique({
      where: { id: unitId },
    });

    if (!unit || !unit.isActive) {
      return NextResponse.json(
        { error: "Clearing unit not found or is inactive." },
        { status: 404 }
      );
    }

    // Enforce Sequential Clearance Order.
    // Every active unit earlier in the sequence must be APPROVED, not just the
    // one immediately before this unit — otherwise a single approved
    // predecessor would unlock the rest of the chain.
    const precedingUnits = await prisma.clearingUnit.findMany({
      where: {
        sortOrder: { lt: unit.sortOrder },
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    if (precedingUnits.length > 0) {
      const precedingRequests = await prisma.clearanceRequest.findMany({
        where: {
          studentId: user.userId,
          unitId: { in: precedingUnits.map((u) => u.id) },
        },
        select: { unitId: true, status: true },
      });

      const statusByUnitId = new Map(
        precedingRequests.map((r) => [r.unitId, r.status])
      );

      const blockingUnit = precedingUnits.find(
        (u) => statusByUnitId.get(u.id) !== ClearanceStatus.APPROVED
      );

      if (blockingUnit) {
        return NextResponse.json(
          {
            error: `Sequential clearance required. You must obtain approval from "${blockingUnit.name}" before submitting documents for "${unit.name}".`,
          },
          { status: 400 }
        );
      }
    }

    let clearanceRequest = await prisma.clearanceRequest.findUnique({
      where: {
        studentId_unitId: {
          studentId: user.userId,
          unitId: unitId,
        },
      },
    });

    // If request doesn't exist, initialize it
    if (!clearanceRequest) {
      clearanceRequest = await prisma.clearanceRequest.create({
        data: {
          studentId: user.userId,
          unitId: unitId,
          status: ClearanceStatus.NOT_SUBMITTED,
        },
      });
    }

    // 4. State Guard: If already APPROVED, block modification
    if (clearanceRequest.status === ClearanceStatus.APPROVED) {
      return NextResponse.json(
        { error: "Forbidden: This clearing unit has already been approved and cannot be modified." },
        { status: 403 }
      );
    }

    // 5. Parse Multipart Form Data
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "At least one document file is required for submission." },
        { status: 400 }
      );
    }

    // Validate size and type for all files
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only PDF, JPEG, and PNG are allowed.` },
          { status: 400 }
        );
      }

      if (file.size > maxSizeBytes) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Maximum file size is 5MB.` },
          { status: 413 } // Payload Too Large
        );
      }
    }

    // 6. Upload Files & Calculate Checksums
    const uploadedDocs: { fileName: string; fileUrl: string; checksum: string }[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Calculate SHA-256 checksum for integrity verification
      const checksum = crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");

      // Upload file
      const fileUrl = await uploadFile(buffer, file.name, file.type);
      
      uploadedDocs.push({
        fileName: file.name,
        fileUrl,
        checksum,
      });
    }

    // 7. DB Update inside transaction
    const finalRequest = await prisma.$transaction(async (tx) => {
      // Delete previous documents for this request (overwrite submission)
      await tx.document.deleteMany({
        where: { requestId: clearanceRequest.id },
      });

      // Insert new documents
      await tx.document.createMany({
        data: uploadedDocs.map((doc) => ({
          requestId: clearanceRequest.id,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          checksum: doc.checksum,
        })),
      });

      // Update Clearance Request status
      return await tx.clearanceRequest.update({
        where: { id: clearanceRequest.id },
        data: {
          status: ClearanceStatus.PENDING_REVIEW,
          submittedAt: new Date(),
          rejectionNote: null, // Clear any previous rejection message
        },
        include: {
          documents: true,
        },
      });
    });

    // 8. Audit Log
    await createAuditLog({
      actorId: user.userId,
      actorRole: Role.STUDENT,
      action: "SUBMIT_CLEARANCE_DOCUMENTS",
      entityType: "ClearanceRequest",
      entityId: finalRequest.id,
      metadata: {
        unitId,
        unitName: unit.name,
        documentCount: uploadedDocs.length,
      },
    });

    return NextResponse.json({
      message: "Clearance documents submitted successfully.",
      clearanceRequest: finalRequest,
    });
  } catch (error: any) {
    console.error("Submit clearance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
