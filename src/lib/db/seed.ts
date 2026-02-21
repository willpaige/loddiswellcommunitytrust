import { db } from "@/lib/db";
import { users } from "./schema";

const trustees = [
  { email: "zoe.c.crockford@gmail.com", name: "Zoe", role: "admin" as const },
  { email: "davidcrockford@regpower.co.uk", name: "David", role: "admin" as const },
  { email: "r.stuartr@yahoo.co.uk", name: "Stuart", role: "admin" as const },
  { email: "alisonjchampion78@gmail.com", name: "Alison", role: "admin" as const },
  { email: "harriet.s.morris@outlook.com", name: "Harriet", role: "admin" as const },
  { email: "livprowse@btinternet.com", name: "Liv", role: "admin" as const },
  { email: "mat@mitchtonks.co.uk", name: "Mat", role: "admin" as const },
  { email: "will@paige.me.uk", name: "Will", role: "admin" as const },
];

async function seed() {
  console.log("Seeding trustees...");

  for (const trustee of trustees) {
    await db
      .insert(users)
      .values(trustee)
      .onConflictDoUpdate({
        target: users.email,
        set: { name: trustee.name, role: trustee.role },
      });
    console.log(`  ✓ ${trustee.name} (${trustee.email})`);
  }

  console.log("Done.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
