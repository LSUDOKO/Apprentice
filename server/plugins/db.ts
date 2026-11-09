import { runMigrations } from "@agent-native/core/db";

import { APPRENTICE_MIGRATIONS } from "../db/migrations.js";

export default runMigrations(APPRENTICE_MIGRATIONS, { table: "apprentice_migrations" });
