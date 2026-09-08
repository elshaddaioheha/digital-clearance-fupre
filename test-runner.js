const { spawn } = require("child_process");
const http = require("http");

const APP_URL = "http://localhost:3000";
let devServerProcess = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeRequest(url, method = "GET", headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsedData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("\n==========================================");
  console.log("STARTING DSCS BACKEND END-TO-END USER FLOW TESTS");
  console.log("==========================================\n");

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      testPassed++;
    } else {
      console.error(`[FAIL] ${message}`);
      testFailed++;
    }
  }

  try {
    // Test 1: Public endpoint auth check
    console.log("Test 1: Accessing student profile without token...");
    const res1 = await makeRequest(`${APP_URL}/api/students/me`);
    assert(
      res1.status === 401,
      `Accessing /api/students/me without token returned status 401 (got ${res1.status})`
    );

    // Test 2: Student Login
    console.log("\nTest 2: Logging in graduating student...");
    const loginRes = await makeRequest(`${APP_URL}/api/auth/login`, "POST", {}, {
      email: "student@fupre.edu.ng",
      password: "studentpassword"
    });
    
    assert(loginRes.status === 200, `Student login returned status 200 (got ${loginRes.status})`);
    assert(loginRes.body.accessToken !== undefined, "Response body contains accessToken");
    assert(loginRes.body.user?.role === "STUDENT", `User role is 'STUDENT' (got '${loginRes.body.user?.role}')`);

    const studentToken = loginRes.body.accessToken;
    const studentUserId = loginRes.body.user.id;

    // Test 3: Fetch Student Profile
    console.log("\nTest 3: Fetching student profile...");
    const profileRes = await makeRequest(`${APP_URL}/api/students/me`, "GET", {
      "Authorization": `Bearer ${studentToken}`
    });
    
    assert(profileRes.status === 200, `Fetching profile returned status 200 (got ${profileRes.status})`);
    assert(profileRes.body.matricNumber === "CSC/2021/001", `Matric number matches 'CSC/2021/001' (got '${profileRes.body.matricNumber}')`);
    assert(profileRes.body.department === "Computer Science", `Department is 'Computer Science'`);

    // Test 4: Fetch Student Clearance Status Matrix
    console.log("\nTest 4: Fetching student clearance status matrix...");
    const statusRes = await makeRequest(`${APP_URL}/api/clearance/my-status`, "GET", {
      "Authorization": `Bearer ${studentToken}`
    });

    assert(statusRes.status === 200, `Fetching clearance status returned status 200 (got ${statusRes.status})`);
    assert(statusRes.body.clearanceRequests?.length === 10, `Found 10 clearance requests (got ${statusRes.body.clearanceRequests?.length})`);
    
    const firstReq = statusRes.body.clearanceRequests?.[0];
    assert(firstReq !== undefined, "First unit clearance request exists");

    // Test 5: Staff Login & Queue Inspection
    console.log("\nTest 5: Logging in HOD Staff Officer...");
    const staffLoginRes = await makeRequest(`${APP_URL}/api/auth/login`, "POST", {}, {
      email: "academic_staff@fupre.edu.ng",
      password: "academicpassword"
    });

    assert(staffLoginRes.status === 200, `Staff login returned status 200 (got ${staffLoginRes.status})`);
    assert(staffLoginRes.body.user?.role === "STAFF", `User role is 'STAFF' (got '${staffLoginRes.body.user?.role}')`);

    const staffToken = staffLoginRes.body.accessToken;

    console.log("\nTest 6: Staff fetching own profile & assigned unit...");
    const staffInfoRes = await makeRequest(`${APP_URL}/api/staff/me`, "GET", {
      "Authorization": `Bearer ${staffToken}`
    });
    assert(staffInfoRes.status === 200, `Fetching own staff profile returned status 200 (got ${staffInfoRes.status})`);

    const assignedUnit = staffInfoRes.body.assignments?.[0];
    assert(assignedUnit?.unitName === "Head of Department", `Staff is assigned to 'Head of Department' (got '${assignedUnit?.unitName}')`);

    // The full staff directory exposes every colleague's contact details and is
    // admin-only; a staff account must not be able to read it.
    const staffDirectoryRes = await makeRequest(`${APP_URL}/api/admin/staff`, "GET", {
      "Authorization": `Bearer ${staffToken}`
    });
    assert(staffDirectoryRes.status === 403, `Staff reading the full staff directory is forbidden (got ${staffDirectoryRes.status})`);

    // Test 7: Student submits clearance documents
    console.log("\nTest 7: Student submitting clearance documents...");
    const hodUnit = statusRes.body.clearanceRequests.find((r) => r.clearingUnit.name === "Head of Department");

    const submitForm = new FormData();
    submitForm.append(
      "files",
      new Blob([Buffer.from("%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF")], { type: "application/pdf" }),
      "registration-file.pdf"
    );

    const submitRes = await fetch(`${APP_URL}/api/clearance/${hodUnit.unitId}/submit`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${studentToken}` },
      body: submitForm,
    });
    const submitBody = await submitRes.json();

    assert(submitRes.status === 200, `Document submission returned status 200 (got ${submitRes.status})`);
    assert(submitBody.clearanceRequest?.status === "PENDING_REVIEW", `Unit moved to 'PENDING_REVIEW' (got '${submitBody.clearanceRequest?.status}')`);
    assert(submitBody.clearanceRequest?.documents?.length === 1, `One document was stored (got ${submitBody.clearanceRequest?.documents?.length})`);
    assert(/^[a-f0-9]{64}$/.test(submitBody.clearanceRequest?.documents?.[0]?.checksum || ""), "Server recorded a SHA-256 checksum for the document");

    const hodRequestId = submitBody.clearanceRequest.id;

    // Test 8: Sequential clearance gate
    console.log("\nTest 8: Enforcing sequential clearance order...");
    const libraryUnit = statusRes.body.clearanceRequests.find((r) => r.clearingUnit.name === "University Library");

    const skipForm = new FormData();
    skipForm.append(
      "files",
      new Blob([Buffer.from("%PDF-1.4\n%%EOF")], { type: "application/pdf" }),
      "library.pdf"
    );

    const skipRes = await fetch(`${APP_URL}/api/clearance/${libraryUnit.unitId}/submit`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${studentToken}` },
      body: skipForm,
    });
    const skipBody = await skipRes.json();

    assert(skipRes.status === 400, `Submitting out of sequence is rejected (got ${skipRes.status})`);
    assert(/Sequential clearance required/.test(skipBody.error || ""), "Rejection names the sequential clearance rule");

    // Test 9: Review guards
    console.log("\nTest 9: Enforcing review guards...");
    const anonApproveRes = await makeRequest(`${APP_URL}/api/submissions/${hodRequestId}/approve`, "PATCH");
    assert(anonApproveRes.status === 401, `Approving without a token is unauthorized (got ${anonApproveRes.status})`);

    // Authenticated but nonexistent: proves the 401 above is not leaking record existence
    const missingApproveRes = await makeRequest(`${APP_URL}/api/submissions/00000000-0000-0000-0000-000000000000/approve`, "PATCH", {
      "Authorization": `Bearer ${staffToken}`
    });
    assert(missingApproveRes.status === 404, `Approving a nonexistent request returns 404 (got ${missingApproveRes.status})`);

    const collegeLoginRes = await makeRequest(`${APP_URL}/api/auth/login`, "POST", {}, {
      email: "college_staff@fupre.edu.ng",
      password: "collegepassword"
    });
    const collegeToken = collegeLoginRes.body.accessToken;

    const crossUnitRes = await makeRequest(`${APP_URL}/api/submissions/${hodRequestId}/approve`, "PATCH", {
      "Authorization": `Bearer ${collegeToken}`
    });
    assert(crossUnitRes.status === 403, `Staff cannot approve another unit's request (got ${crossUnitRes.status})`);

    const collegeUnitReq = statusRes.body.clearanceRequests.find((r) => r.clearingUnit.name === "College");
    const unsubmittedRes = await makeRequest(`${APP_URL}/api/submissions/${collegeUnitReq.id}/approve`, "PATCH", {
      "Authorization": `Bearer ${collegeToken}`
    });
    assert(unsubmittedRes.status === 409, `Approving a request with no submitted documents is refused (got ${unsubmittedRes.status})`);

    // Test 10: Staff approves the submitted request
    console.log("\nTest 10: Staff approving submitted clearance request...");
    const approveRes = await makeRequest(`${APP_URL}/api/submissions/${hodRequestId}/approve`, "PATCH", {
      "Authorization": `Bearer ${staffToken}`
    });

    assert(approveRes.status === 200, `Approval returned status 200 (got ${approveRes.status})`);
    assert(approveRes.body.clearanceRequest?.status === "APPROVED", `Unit status is 'APPROVED' (got '${approveRes.body.clearanceRequest?.status}')`);

    const reApproveRes = await makeRequest(`${APP_URL}/api/submissions/${hodRequestId}/approve`, "PATCH", {
      "Authorization": `Bearer ${staffToken}`
    });
    assert(reApproveRes.status === 409, `Re-approving an already decided request is refused (got ${reApproveRes.status})`);

    // Test 11: Admin Login & Full System Overview
    console.log("\nTest 11: Logging in Admin...");
    const adminLoginRes = await makeRequest(`${APP_URL}/api/auth/login`, "POST", {}, {
      email: "admin@fupre.edu.ng",
      password: "adminpassword"
    });

    assert(adminLoginRes.status === 200, `Admin login returned status 200 (got ${adminLoginRes.status})`);
    assert(adminLoginRes.body.user?.role === "ADMIN", `User role is 'ADMIN' (got '${adminLoginRes.body.user?.role}')`);

    const adminToken = adminLoginRes.body.accessToken;

    // Test 12: Admin List Students & Audit Logs
    console.log("\nTest 12: Admin fetching students directory & system audit logs...");
    const studentsRes = await makeRequest(`${APP_URL}/api/admin/students`, "GET", {
      "Authorization": `Bearer ${adminToken}`
    });

    assert(studentsRes.status === 200, `Admin list students returned status 200 (got ${studentsRes.status})`);
    assert(studentsRes.body.students?.length > 0, "Student list contains registered students");

    const auditRes = await makeRequest(`${APP_URL}/api/admin/audit-logs`, "GET", {
      "Authorization": `Bearer ${adminToken}`
    });
    assert(auditRes.status === 200, `Admin audit logs endpoint returned status 200 (got ${auditRes.status})`);

    // Test 13: Admin Manual Override Test
    if (firstReq) {
      console.log("\nTest 13: Admin manual override of clearance unit...");
      const overrideRes = await makeRequest(`${APP_URL}/api/admin/clearance/${firstReq.id}/override`, "POST", {
        "Authorization": `Bearer ${adminToken}`
      }, {
        status: "APPROVED",
        justification: "Verified physical records and automated system test clearance."
      });

      assert(overrideRes.status === 200, `Admin override returned status 200 (got ${overrideRes.status})`);
      assert(overrideRes.body.clearanceRequest?.status === "APPROVED", `Unit status overridden to 'APPROVED'`);
    }

    // Test 14: Verify Certificate Route Accessibility
    console.log("\nTest 14: Verifying digital clearance certificate PDF route...");
    const certRes = await makeRequest(`${APP_URL}/api/certificates/${studentUserId}?token=${studentToken}`);
    assert(certRes.status === 200 || certRes.status === 400 || certRes.status === 403, `Certificate PDF endpoint responded with code ${certRes.status}`);

    // Final Report
    console.log("\n==========================================");
    console.log("END-TO-END VERIFICATION TEST REPORT SUMMARY");
    console.log(`PASSED: ${testPassed}`);
    console.log(`FAILED: ${testFailed}`);
    console.log("==========================================\n");

    return testFailed === 0;

  } catch (error) {
    console.error("Test execution encountered an error:", error);
    return false;
  }
}

async function main() {
  console.log("Starting Next.js Dev Server...");
  
  devServerProcess = spawn("npx", ["next", "dev", "-p", "3000"], {
    shell: true,
    stdio: "inherit",
  });

  console.log("Waiting 20 seconds for Next.js to start up...");
  await sleep(20000);

  let success = false;
  try {
    success = await runTests();
  } catch (err) {
    console.error("Tests crashed:", err);
  } finally {
    console.log("Shutting down Next.js Dev Server...");
    if (devServerProcess) {
      await stopDevServer(devServerProcess);
    }
  }

  process.exit(success ? 0 : 1);
}

/**
 * Stops the dev server and waits for it to actually be gone.
 *
 * `npx next dev` runs Next in a grandchild process, so on Windows a SIGTERM to
 * the npx wrapper leaves the real server holding port 3000 and the inherited
 * stdio pipe. The old code fired taskkill without awaiting it and then called
 * process.exit immediately, so the server routinely outlived the test run.
 */
function stopDevServer(child) {
  return new Promise((resolve) => {
    // Never hang the run on a kill that misbehaves.
    const bail = setTimeout(resolve, 10000);
    bail.unref?.();

    const done = () => {
      clearTimeout(bail);
      resolve();
    };

    if (process.platform === "win32") {
      try {
        const killer = spawn("taskkill", ["/pid", child.pid, "/f", "/t"], {
          stdio: "ignore",
        });
        killer.on("exit", done);
        killer.on("error", done);
      } catch (e) {
        done();
      }
      return;
    }

    child.on("exit", done);
    child.kill("SIGTERM");
  });
}

main();
