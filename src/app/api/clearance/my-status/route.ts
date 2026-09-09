import { NextResponse } from "next/server";
import { Role, ClearanceStatus } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveFileUrls } from "@/lib/storage";

export async function GET(req: Request) {
  try {
    // 1. Authenticate & Require Student Role
    const { user, errorResponse } = await requireRole(req, [Role.STUDENT]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Backfill any missing rows before reading.
    //
    // Units created after a student registered have no request row yet. This
    // runs first and is idempotent — skipDuplicates makes two concurrent first
    // loads safe, where the previous version raced on the
    // [studentId, unitId] unique constraint and returned a 500.
    const activeUnits = await prisma.clearingUnit.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (activeUnits.length > 0) {
      await prisma.clearanceRequest.createMany({
        data: activeUnits.map((unit) => ({
          studentId: user.userId,
          unitId: unit.id,
          status: ClearanceStatus.NOT_SUBMITTED,
        })),
        skipDuplicates: true,
      });
    }

    // 3. Fetch all clearance requests for the student
    const requests = await prisma.clearanceRequest.findMany({
      where: { studentId: user.userId },
      include: {
        clearingUnit: {
          select: {
            id: true,
            name: true,
            description: true,
            sortOrder: true,
          },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: {
        clearingUnit: {
          sortOrder: "asc",
        },
      },
    });

    // The bucket is private, so stored references are turned into short-lived
    // signed URLs here rather than being handed out as durable links.
    const signed = await resolveFileUrls(
      requests.flatMap((r) => r.documents.map((d) => d.fileUrl))
    );

    return NextResponse.json({
      clearanceRequests: requests.map((r) => ({
        ...r,
        documents: r.documents.map((d) => ({
          ...d,
          fileUrl: signed.get(d.fileUrl) ?? null,
        })),
      })),
    });
  } catch (error) {
    console.error("Fetch clearance status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
