import { NextResponse } from "next/server";
import { Role, ClearanceStatus } from "@/lib/auth";
import { requireRole, checkUnitAccess } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await props.params;

    // 1. Authenticate before touching the database, so an anonymous caller
    // cannot tell an existing request ID from a missing one.
    const { user, errorResponse } = await requireRole(req, [Role.STAFF, Role.ADMIN]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Load the request, then authorize the reviewer against its unit.
    const clearanceRequest = await prisma.clearanceRequest.findUnique({
      where: { id: requestId },
      include: {
        clearingUnit: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!clearanceRequest) {
      return NextResponse.json(
        { error: "Clearance request not found." },
        { status: 404 }
      );
    }

    const accessError = await checkUnitAccess(user, clearanceRequest.unitId);
    if (accessError) return accessError;

    // 3. State Guard: only a request the student has actually submitted may be
    // reviewed. Blocks approving NOT_SUBMITTED requests (which carry no
    // documents) and re-reviewing one that was already decided.
    const reviewableStatuses: string[] = [
      ClearanceStatus.PENDING_REVIEW,
      ClearanceStatus.UNDER_REVIEW,
    ];

    if (!reviewableStatuses.includes(clearanceRequest.status)) {
      return NextResponse.json(
        {
          error:
            clearanceRequest.status === ClearanceStatus.NOT_SUBMITTED
              ? "Conflict: This student has not submitted any documents for this unit yet."
              : `Conflict: This request has already been reviewed (${clearanceRequest.status}) and cannot be approved again.`,
          currentStatus: clearanceRequest.status,
        },
        { status: 409 }
      );
    }

    // 4. Update Request Status to APPROVED in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.clearanceRequest.update({
        where: { id: requestId },
        data: {
          status: ClearanceStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: user.userId,
          rejectionNote: null,
        },
      });

      // Create Notification for the student
      await tx.notification.create({
        data: {
          userId: clearanceRequest.studentId,
          type: "STATUS_CHANGE",
          message: `Your clearance request for the University ${clearanceRequest.clearingUnit.name} has been APPROVED.`,
        },
      });

      // Check if all active clearing units are approved for this student
      const allRequests = await tx.clearanceRequest.findMany({
        where: { studentId: clearanceRequest.studentId },
        include: {
          clearingUnit: true,
        },
      });

      const totalActiveUnits = await tx.clearingUnit.count({
        where: { isActive: true },
      });

      const approvedRequests = allRequests.filter(
        (r) => r.status === ClearanceStatus.APPROVED && r.clearingUnit.isActive
      );

      const isFullyCleared = approvedRequests.length === totalActiveUnits;

      return { updatedRequest, isFullyCleared, approvedCount: approvedRequests.length, totalCount: totalActiveUnits };
    });

    // 5. Write Audit Log
    await createAuditLog({
      actorId: user.userId,
      actorRole: user.role as Role,
      action: "APPROVE_CLEARANCE_REQUEST",
      entityType: "ClearanceRequest",
      entityId: result.updatedRequest.id,
      metadata: {
        studentId: clearanceRequest.studentId,
        unitId: clearanceRequest.unitId,
        unitName: clearanceRequest.clearingUnit.name,
        isFullyCleared: result.isFullyCleared,
      },
    });

    if (result.isFullyCleared) {
      // Write another audit log indicating the student is now fully cleared
      await createAuditLog({
        actorRole: Role.ADMIN, // Treated as system action
        action: "STUDENT_FULLY_CLEARED",
        entityType: "Student",
        entityId: clearanceRequest.studentId,
        metadata: {
          studentId: clearanceRequest.studentId,
          msg: "All clearing units have approved. Certificate is now downloadable.",
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
      message: "Clearance request approved successfully.",
      clearanceRequest: result.updatedRequest,
      isFullyCleared: result.isFullyCleared,
    });
  } catch (error) {
    console.error("Approve clearance request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
