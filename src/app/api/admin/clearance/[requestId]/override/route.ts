import { NextResponse } from "next/server";
import { Role, ClearanceStatus } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  req: Request,
  props: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await props.params;

    // 1. Authenticate & Verify Admin Role
    const { user, errorResponse } = await requireRole(req, [Role.ADMIN]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and Validate Body
    const body = await req.json();
    const { status, justification } = body;

    if (!status || !Object.values(ClearanceStatus).includes(status as ClearanceStatus)) {
      return NextResponse.json(
        { error: "Bad Request: A valid target status is required." },
        { status: 400 }
      );
    }

    if (!justification || typeof justification !== "string" || justification.trim().length === 0) {
      return NextResponse.json(
        { error: "Bad Request: A written override justification is required." },
        { status: 400 }
      );
    }

    // 3. Find Clearance Request
    const clearanceRequest = await prisma.clearanceRequest.findUnique({
      where: { id: requestId },
      include: {
        clearingUnit: {
          select: { name: true },
        },
      },
    });

    if (!clearanceRequest) {
      return NextResponse.json(
        { error: "Clearance request not found." },
        { status: 404 }
      );
    }

    const previousStatus = clearanceRequest.status;

    // Check if the performing actor has a record in the Staff table
    const staffRecord = await prisma.staff.findUnique({
      where: { userId: user.userId },
    });

    // 4. DB Transaction to perform override and notifications
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.clearanceRequest.update({
        where: { id: requestId },
        data: {
          status: status as ClearanceStatus,
          reviewedAt: new Date(),
          reviewedBy: staffRecord ? user.userId : null,
          rejectionNote: status === ClearanceStatus.REJECTED ? justification.trim() : null,
        },
      });

      // Create Notification for Student
      await tx.notification.create({
        data: {
          userId: clearanceRequest.studentId,
          type: "STATUS_CHANGE",
          message: `An Administrator has overridden your clearance status for ${
            clearanceRequest.clearingUnit.name
          } from ${previousStatus} to ${status}. Justification: "${justification.trim()}"`,
        },
      });

      // Check if student is now fully cleared (only if target status is APPROVED)
      let isFullyCleared = false;
      if (status === ClearanceStatus.APPROVED) {
        const allRequests = await tx.clearanceRequest.findMany({
          where: { studentId: clearanceRequest.studentId },
          include: { clearingUnit: true },
        });

        const totalActiveUnits = await tx.clearingUnit.count({
          where: { isActive: true },
        });

        const approvedRequests = allRequests.filter(
          (r) => r.status === ClearanceStatus.APPROVED && r.clearingUnit.isActive
        );

        isFullyCleared = approvedRequests.length === totalActiveUnits;
      }

      return { updated, isFullyCleared };
    });

    // 5. Audit Log override action
    await createAuditLog({
      actorId: user.userId,
      actorRole: Role.ADMIN,
      action: "ADMIN_OVERRIDE_CLEARANCE",
      entityType: "ClearanceRequest",
      entityId: clearanceRequest.id,
      metadata: {
        studentId: clearanceRequest.studentId,
        unitId: clearanceRequest.unitId,
        unitName: clearanceRequest.clearingUnit.name,
        previousStatus,
        newStatus: status,
        justification: justification.trim(),
        isFullyCleared: result.isFullyCleared,
      },
    });

    if (result.isFullyCleared) {
      // Write another audit log indicating the student is now fully cleared
      await createAuditLog({
        actorRole: Role.ADMIN,
        action: "STUDENT_FULLY_CLEARED",
        entityType: "Student",
        entityId: clearanceRequest.studentId,
        metadata: {
          studentId: clearanceRequest.studentId,
          msg: "Student reached FULLY_CLEARED state via Admin override.",
        },
      });

      // Create another notification for full clearance
      await prisma.notification.create({
        data: {
          userId: clearanceRequest.studentId,
          type: "GENERAL",
          message: "Congratulations! You are now FULLY CLEARED. You can download your graduation clearance certificate.",
        },
      });
    }

    return NextResponse.json({
      message: "Clearance status overridden successfully.",
      clearanceRequest: result.updated,
      isFullyCleared: result.isFullyCleared,
    });
  } catch (error) {
    console.error("Admin override error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
