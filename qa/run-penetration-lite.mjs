const baseUrl = process.env.BASE_URL || "http://localhost:5000/api";

const tests = [
  {
    name: "NoSQL-like payload on login",
    path: "/auth/login",
    method: "POST",
    body: { email: { $ne: null }, password: "x" },
    expectBlocked: true,
  },
  {
    name: "SQL-like payload on login",
    path: "/auth/login",
    method: "POST",
    body: { email: "admin' OR '1'='1", password: "x" },
    expectBlocked: true,
  },
  {
    name: "XSS payload in register name",
    path: "/auth/register",
    method: "POST",
    body: { name: "<script>alert(1)</script>", email: `xss_${Date.now()}@test.com`, password: "StrongPass123!" },
    expectBlocked: true,
  },
];

let blocked = 0;
let total = 0;

for (const t of tests) {
  total += 1;
  try {
    const res = await fetch(`${baseUrl}${t.path}`, {
      method: t.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t.body),
    });

    const isBlocked = res.status >= 400;
    if (isBlocked) {
      blocked += 1;
      console.log(`[OK] ${t.name} blocked with ${res.status}`);
    } else {
      console.error(`[WARN] ${t.name} was not blocked (status ${res.status})`);
    }
  } catch (error) {
    console.error(`[SKIP] ${t.name} could not run: ${error.message}`);
  }
}

console.log(`\nPenetration-lite summary: blocked ${blocked}/${total}`);
if (process.argv.includes("--strict") && blocked < total) {
  process.exit(1);
}

