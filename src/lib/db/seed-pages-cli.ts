// Seeds page content only, without touching facilities or bookings.
// Existing pages are left untouched — only missing pages are inserted.
// Run with: npm run db:seed:pages
import { seedPages } from "./seed-pages";

seedPages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
