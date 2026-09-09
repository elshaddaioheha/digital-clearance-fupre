import { NextResponse } from "next/server";
import { Role, ClearanceStatus } from "@/lib/auth";
import { requireUnitAccess } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveFileUrls } from "@/lib/storage";

export async function GET(
  req: Request,
  props: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await props.params;

    // 1. Authenticate & Verify Unit Access (checks assignments for STAFF, allows ADMIN)
    const { user, errorResponse } = await requireUnitAccess(req, unitId);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    const whereClause: any = {
      unitId: unitId,
    };

    if (statusParam) {
      // Filter by a specific status
      if (Object.values(ClearanceStatus).includes(statusParam as ClearanceStatus)) {
        whereClause.status = statusParam as ClearanceStatus;
      } else {
        return NextResponse.json({ error: "Invalid status query parameter" }, { status: 400 });
      }
    } else {
      // By default, return all requests except those NOT_SUBMITTED
      whereClause.status = {
        in: [
          ClearanceStatus.PENDING_REVIEW,
          ClearanceStatus.UNDER_REVIEW,
          ClearanceStatus.APPROVED,
          ClearanceStatus.REJECTED,
        ],
      };
    }

    // 3. Fetch submissions
    const submissions = await prisma.clearanceRequest.findMany({
      where: whereClause,
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            checksum: true,
            uploadedAt: true,
          },
        },
        student: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    const signed = await resolveFileUrls(
      submissions.flatMap((sub) => sub.documents.map((d) => d.fileUrl))
    );

    return NextResponse.json({
      submissions: submissions.map((sub) => ({
        id: sub.id,
        status: sub.status,
        submittedAt: sub.submittedAt,
        reviewedAt: sub.reviewedAt,
        rejectionNote: sub.rejectionNote,
        documents: sub.documents.map((d) => ({
          ...d,
          fileUrl: signed.get(d.fileUrl) ?? null,
        })),
        student: {
          id: sub.student.userId,
          name: sub.student.user.name,
          email: sub.student.user.email,
          phone: sub.student.user.phone,
          matricNumber: sub.student.matricNumber,
          department: sub.student.department,
          faculty: sub.student.faculty,
          level: sub.student.level,
          sessionOfGraduation: sub.student.sessionOfGraduation,
        },
      })),
    });
  } catch (error) {
    console.error("Fetch submissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
