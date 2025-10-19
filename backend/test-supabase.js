// backend/test-supabase.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function testConnection() {
  console.log("Testing Supabase connection...\n");

  // Test 1: Check connection
  console.log("1. Testing database connection...");
  const { data: tables, error: tablesError } = await supabase
    .from("invoices")
    .select("count")
    .limit(1);

  if (tablesError) {
    console.error("❌ Database connection failed:", tablesError.message);
  } else {
    console.log("✅ Database connected successfully");
  }

  // Test 2: Check storage
  console.log("\n2. Testing storage connection...");
  const { data: buckets, error: bucketsError } =
    await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error("❌ Storage connection failed:", bucketsError.message);
  } else {
    console.log("✅ Storage connected successfully");
    console.log("📦 Buckets:", buckets.map((b) => b.name).join(", "));
  }

  // Test 3: Check auth
  console.log("\n3. Testing auth...");
  const {
    data: { users },
    error: usersError,
  } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error("❌ Auth connection failed:", usersError.message);
  } else {
    console.log("✅ Auth connected successfully");
    console.log("👥 Total users:", users.length);
  }

  console.log("\n✅ All tests completed!");
}

testConnection();
