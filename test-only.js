const http = require("http");

const APP_URL = "http://localhost:3000";

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

    console.log("\nTest 6: Staff fetching staff profile & assigned unit...");
    const staffInfoRes = await makeRequest(`${APP_URL}/api/admin/staff`, "GET", {
      "Authorization": `Bearer ${staffToken}`
    });
    assert(staffInfoRes.status === 200, `Fetching staff info returned status 200 (got ${staffInfoRes.status})`);

    // Test 7: Admin Login & Full System Overview
    console.log("\nTest 7: Logging in Admin...");
    const adminLoginRes = await makeRequest(`${APP_URL}/api/auth/login`, "POST", {}, {
      email: "admin@fupre.edu.ng",
      password: "adminpassword"
    });

    assert(adminLoginRes.status === 200, `Admin login returned status 200 (got ${adminLoginRes.status})`);
    assert(adminLoginRes.body.user?.role === "ADMIN", `User role is 'ADMIN' (got '${adminLoginRes.body.user?.role}')`);

    const adminToken = adminLoginRes.body.accessToken;

    // Test 8: Admin List Students & Audit Logs
    console.log("\nTest 8: Admin fetching students directory & system audit logs...");
    const studentsRes = await makeRequest(`${APP_URL}/api/admin/students`, "GET", {
      "Authorization": `Bearer ${adminToken}`
    });

    assert(studentsRes.status === 200, `Admin list students returned status 200 (got ${studentsRes.status})`);
    assert(studentsRes.body.students?.length > 0, "Student list contains registered students");

    const auditRes = await makeRequest(`${APP_URL}/api/admin/audit-logs`, "GET", {
      "Authorization": `Bearer ${adminToken}`
    });
    assert(auditRes.status === 200, `Admin audit logs endpoint returned status 200 (got ${auditRes.status})`);

    // Test 9: Admin Manual Override Test
    if (firstReq) {
      console.log("\nTest 9: Admin manual override of clearance unit...");
      const overrideRes = await makeRequest(`${APP_URL}/api/admin/clearance/${firstReq.id}/override`, "POST", {
        "Authorization": `Bearer ${adminToken}`
      }, {
        status: "APPROVED",
        justification: "Verified physical records and automated system test clearance."
      });

      assert(overrideRes.status === 200, `Admin override returned status 200 (got ${overrideRes.status})`);
      assert(overrideRes.body.clearanceRequest?.status === "APPROVED", `Unit status overridden to 'APPROVED'`);
    }

    // Test 10: Verify Certificate Route Accessibility
    console.log("\nTest 10: Verifying digital clearance certificate PDF route...");
    const certRes = await makeRequest(`${APP_URL}/api/certificates/${studentUserId}?token=${studentToken}`);
    assert(certRes.status === 200 || certRes.status === 400 || certRes.status === 403, `Certificate PDF endpoint responded with code ${certRes.status}`);

    // Final Report
    console.log("\n==========================================");
    console.log("END-TO-END VERIFICATION TEST REPORT SUMMARY");
    console.log(`PASSED: ${testPassed}`);
    console.log(`FAILED: ${testFailed}`);
    console.log("==========================================\n");

    process.exit(testFailed === 0 ? 0 : 1);

  } catch (error) {
    console.error("Test execution encountered an error:", error);
    process.exit(1);
  }
}

runTests();
