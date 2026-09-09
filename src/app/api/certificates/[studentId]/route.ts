import { NextResponse } from "next/server";
import { Role, ClearanceStatus } from "@/lib/auth";
import { verifyAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateClearanceCertificate } from "@/lib/pdf";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  req: Request,
  props: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await props.params;

    // 1. Authenticate user
    const { user, errorResponse } = await verifyAuth(req);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Authorization Check: requester must be the student themselves, an ADMIN, or a REGISTRAR
    const isOwner = user.role === Role.STUDENT && user.userId === studentId;
    const isPrivileged = user.role === Role.ADMIN || user.role === Role.REGISTRAR;

    if (!isOwner && !isPrivileged) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this certificate." },
        { status: 403 }
      );
    }

    // 3. Fetch Student Details & Clearance requests
    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        user: {
          select: { name: true },
        },
        clearanceRequests: {
          include: {
            clearingUnit: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    // 4. State Guard: Verify Student is FULLY CLEARED
    const activeUnitsCount = await prisma.clearingUnit.count({
      where: { isActive: true },
    });

    const approvedRequestsCount = student.clearanceRequests.filter(
      (r) => r.status === ClearanceStatus.APPROVED && r.clearingUnit.isActive
    ).length;

    const isFullyCleared = activeUnitsCount > 0 && approvedRequestsCount === activeUnitsCount;

    if (!isFullyCleared) {
      return NextResponse.json(
        {
          error: "Forbidden: You cannot download your clearance certificate until all clearing units have approved your requests.",
          approvedUnits: approvedRequestsCount,
          totalUnits: activeUnitsCount,
        },
        { status: 403 }
      );
    }

    // 5. Generate PDF Certificate
    const pdfBuffer = await generateClearanceCertificate({
      studentName: student.user.name,
      matricNumber: student.matricNumber,
      department: student.department,
      faculty: student.faculty,
      sessionOfGraduation: student.sessionOfGraduation,
      issuedAt: new Date(),
    });

    // 6. Audit Log
    await createAuditLog({
      actorId: user.userId,
      actorRole: user.role as Role,
      action: "DOWNLOAD_CLEARANCE_CERTIFICATE",
      entityType: "Student",
      entityId: studentId,
      metadata: {
        requesterId: user.userId,
        requesterRole: user.role,
      },
    });

    // 7. Return PDF Stream response
    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // A matric number contains slashes (CSC/2021/001), which are not legal
        // in a filename and make browsers truncate at the last one.
        "Content-Disposition": `attachment; filename="Clearance_Certificate_${student.matricNumber
          .toUpperCase()
          .replace(/[^A-Z0-9._-]+/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Download certificate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
