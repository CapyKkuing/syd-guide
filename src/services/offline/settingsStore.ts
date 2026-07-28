import {
  openTravelDatabase,
  resolveTravelDatabase,
  type TravelDatabase,
  type TravelDatabaseSource
} from "./database";

let sharedDatabase: Promise<TravelDatabase> | undefined;

function getSharedDatabase() {
  sharedDatabase ??= openTravelDatabase();
  return sharedDatabase;
}

export class SettingsStore {
  // ESLint's base no-unused-vars rule does not recognize parameter properties.
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly source: TravelDatabaseSource) {}

  async get<T>(key: string): Promise<T | undefined> {
    const database = await resolveTravelDatabase(this.source);
    const record = await database.get("settings", key);
    return record?.value as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    const database = await resolveTravelDatabase(this.source);
    await database.put("settings", { key, value });
  }
}

export const localSettings = new SettingsStore(getSharedDatabase);
