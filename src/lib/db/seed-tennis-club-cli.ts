// Seeds the Tennis Club's standing block-outs only, without touching pages,
// facilities, or bookings. Idempotent — safe to re-run to top up the horizon.
// Run with: npm run db:seed:tennis
import { seedTennisClubSessions } from "./seed-tennis-club";

seedTennisClubSessions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
