const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const schemaPath = path.join(root, "supabase/schema.sql");
const migrationPath = path.join(
  root,
  "supabase/migrations/20261009010000_restrict_profile_reads.sql",
);

function readDefinition(filePath, pattern, label) {
  const sql = fs.readFileSync(filePath, "utf8");
  const definition = sql.match(pattern);
  assert.ok(definition, label + " missing from " + filePath);
  return definition[0].replace(/\s+/g, " ").trim();
}

const profileReader = /create\s+or\s+replace\s+function\s+public\.can_read_profile\s*\(\s*target_profile_id\s+uuid\s*\)[\s\S]*?\$\$\s*;/i;
const profilePolicy = /create\s+policy\s+profiles_read\b[^;]*;/i;

test("forward migration matches canonical profile-read helper and policy", () => {
  assert.equal(
    readDefinition(migrationPath, profileReader, "can_read_profile definition"),
    readDefinition(schemaPath, profileReader, "can_read_profile definition"),
  );
  assert.equal(
    readDefinition(migrationPath, profilePolicy, "profiles_read policy"),
    readDefinition(schemaPath, profilePolicy, "profiles_read policy"),
  );
});
