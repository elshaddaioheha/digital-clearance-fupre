require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcryptjs = require("bcryptjs");

const connectionString = process.env.DATABASE_URL;
const cleanConnectionString = connectionString ? connectionString.split("?")[0] : undefined;
const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  // 1. Clean existing records in dependency order
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.clearanceRequest.deleteMany();
  await prisma.staffUnitAssignment.deleteMany();
  await prisma.clearingUnit.deleteMany();
  await prisma.student.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.user.deleteMany();

  console.log("Database cleaned.");

  // 2. Define standard FUPRE Clearing Units in Sequential Order
  const unitsData = [
    { 
      name: "Head of Department", 
      sortOrder: 1, 
      description: "Final-year Project Submission\nDepartment Book Returns\nCourse Results\nOther Departmental Form" 
    },
    { 
      name: "College", 
      sortOrder: 2, 
      description: "Digitized copy of the 100L College of Science Registration File.\nScanned copies of all Sessional Academic Results (100L - 400L).\nEvidence of payment for NASS (Science Students) Annual Dues.\nScanned Local Government of Origin Identification and Birth Certificate." 
    },
    { 
      name: "Admissions Office", 
      sortOrder: 3, 
      description: "Digitized copy of the official \"Clearance / Authority to Pay\" slip (stamped and signed by the Registrar/Admissions Office during initial 100L/200L registration)." 
    },
    { 
      name: "Bursary", 
      sortOrder: 4, 
      description: "Comprehensive Remita payment receipts for University Tuition Fees (100L - 400L)." 
    },
    { 
      name: "University Library", 
      sortOrder: 5, 
      description: "Scanned image of the FUPRE University Library Registration Card.\nDigital Library No-Debt / Clearance Slip.\nEvidence of Final Year Project hardcopy submission (Library stamped receipt)." 
    },
    { 
      name: "Sports Division", 
      sortOrder: 6, 
      description: "Scanned payment receipts for FUPRE Sports Levies and Dues." 
    },
    { 
      name: "University Health Centre", 
      sortOrder: 7, 
      description: "Scanned image of the FUPRE Medical ID Card.\nDigitized copy of the initial 100L Certificate of Medical Fitness." 
    },
    { 
      name: "Security Department", 
      sortOrder: 8, 
      description: "Scanned payment receipts for University Security Levies.\nDigitized copy of a Sworn Court Affidavit confirming Good Conduct and Non-Membership of Secret Cults." 
    },
    { 
      name: "Student Affairs", 
      sortOrder: 9, 
      description: "Scanned payment receipts for Student Affairs fees and SUG (Student Union Government) Dues (100L - 400L).\nScanned payment receipt for the official University Convocation Fee.\nHostel Clearance Slip (evidence of vacating university accommodation in good condition)." 
    },
    { 
      name: "Exams and Records Review", 
      sortOrder: 10, 
      description: "Approved Statement of Final Degree Results.\nFinal verification of original JAMB and FUPRE Admission Letters." 
    }
  ];

  const units = {};
  for (const unit of unitsData) {
    const record = await prisma.clearingUnit.create({
      data: {
        name: unit.name,
        sortOrder: unit.sortOrder,
        description: unit.description,
      },
    });
    units[unit.name] = record;
  }
  console.log(`Created ${Object.keys(units).length} clearing units.`);

  // 3. Create Admin Account
  const hashedAdminPassword = await bcryptjs.hash("adminpassword", 12);
  const adminUser = await prisma.user.create({
    data: {
      name: "DSCS System Administrator",
      email: "admin@fupre.edu.ng",
      hashedPassword: hashedAdminPassword,
      role: "ADMIN",
      phone: "+2348011112222",
    },
  });
  console.log("Created Admin account:", adminUser.email);

  // 4. Create Registrar Account
  const hashedRegistrarPassword = await bcryptjs.hash("registrarpassword", 12);
  const registrarUser = await prisma.user.create({
    data: {
      name: "FUPRE Academic Registrar",
      email: "registrar@fupre.edu.ng",
      hashedPassword: hashedRegistrarPassword,
      role: "REGISTRAR",
      phone: "+2348033334444",
    },
  });
  console.log("Created Registrar account:", registrarUser.email);

  // 5. Create Staff Accounts for all 10 clearing units
  const staffConfigs = [
    {
      name: "Academic Head of Department",
      email: "academic_staff@fupre.edu.ng",
      password: "academicpassword",
      unitName: "Head of Department",
    },
    {
      name: "College Officer",
      email: "college_staff@fupre.edu.ng",
      password: "collegepassword",
      unitName: "College",
    },
    {
      name: "Admissions Officer",
      email: "admissions_staff@fupre.edu.ng",
      password: "admissionspassword",
      unitName: "Admissions Office",
    },
    {
      name: "Bursary Officer",
      email: "bursary_staff@fupre.edu.ng",
      password: "bursarypassword",
      unitName: "Bursary",
    },
    {
      name: "Library Officer",
      email: "library_staff@fupre.edu.ng",
      password: "librarypassword",
      unitName: "University Library",
    },
    {
      name: "Sports Officer",
      email: "sports_staff@fupre.edu.ng",
      password: "sportspassword",
      unitName: "Sports Division",
    },
    {
      name: "Health Center Officer",
      email: "health_staff@fupre.edu.ng",
      password: "healthpassword",
      unitName: "University Health Centre",
    },
    {
      name: "Security Officer",
      email: "security_staff@fupre.edu.ng",
      password: "securitypassword",
      unitName: "Security Department",
    },
    {
      name: "Student Affairs Officer",
      email: "sa_staff@fupre.edu.ng",
      password: "sapassword",
      unitName: "Student Affairs",
    },
    {
      name: "Exams and Records Officer",
      email: "exams_staff@fupre.edu.ng",
      password: "examspassword",
      unitName: "Exams and Records Review",
    },
  ];

  for (const config of staffConfigs) {
    const hashedPassword = await bcryptjs.hash(config.password, 12);
    const user = await prisma.user.create({
      data: {
        name: config.name,
        email: config.email,
        hashedPassword,
        role: "STAFF",
        phone: "+2348055556666",
      },
    });

    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
      },
    });

    const assignedUnit = units[config.unitName];
    if (assignedUnit) {
      await prisma.staffUnitAssignment.create({
        data: {
          staffId: staff.userId,
          unitId: assignedUnit.id,
        },
      });
      console.log(`Created Staff: ${user.email} assigned to ${config.unitName}`);
    }
  }

  // 6. Create Student Account
  const hashedStudentPassword = await bcryptjs.hash("studentpassword", 12);
  const studentUser = await prisma.user.create({
    data: {
      name: "FUPRE Graduating Student",
      email: "student@fupre.edu.ng",
      hashedPassword: hashedStudentPassword,
      role: "STUDENT",
      phone: "+2348077778888",
    },
  });

  const studentProfile = await prisma.student.create({
    data: {
      userId: studentUser.id,
      matricNumber: "CSC/2021/001",
      department: "Computer Science",
      faculty: "Science",
      level: "400 Level",
      sessionOfGraduation: "2024/2025",
    },
  });

  // Pre-initialize clearance requests for this student
  const activeUnits = await prisma.clearingUnit.findMany({
    where: { isActive: true },
  });

  await prisma.clearanceRequest.createMany({
    data: activeUnits.map((unit) => ({
      studentId: studentUser.id,
      unitId: unit.id,
      status: "NOT_SUBMITTED",
    })),
  });

  console.log(`Created Student: ${studentUser.email} with ${activeUnits.length} clearance requests initialized.`);
  console.log("Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
