const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(
  root,
  "supabase/migrations/20261009000000_fix_create_room_random_code.sql",
);
const contractPath = path.join(root, "supabase/tests/lobby-contract.sql");

function readCreateRoomDefinition(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  const definition = sql.match(
    /create\s+or\s+replace\s+function\s+public\.create_room\s*\(\s*\)[\s\S]*?\$\$\s*;/i,
  );

  assert.ok(definition, `CREATE OR REPLACE public.create_room() missing from ${filePath}`);
  return definition[0];
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}

test("transaction contract uses same create_room definition as forward migration", () => {
  const migrationDefinition = readCreateRoomDefinition(migrationPath);
  const contractDefinition = readCreateRoomDefinition(contractPath);

  assert.equal(
    normalizeSql(contractDefinition),
    normalizeSql(migrationDefinition),
    "lobby-contract.sql must exercise the exact create_room migration definition",
  );
});
