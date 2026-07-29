/* eslint-disable no-unused-vars */
import {
  resolveTravelDatabase,
  type TravelDatabaseSource,
} from "../../../services/offline/database";
import type { TravelReel } from "./types";

export class ReelStore {
  constructor(private readonly database: TravelDatabaseSource) {}

  async get(tripId: string): Promise<TravelReel | null> {
    const database = await resolveTravelDatabase(this.database);
    return await database.get("reels", tripId) ?? null;
  }

  async save(reel: TravelReel): Promise<void> {
    const database = await resolveTravelDatabase(this.database);
    await database.put("reels", reel);
  }

  async remove(tripId: string): Promise<void> {
    const database = await resolveTravelDatabase(this.database);
    await database.delete("reels", tripId);
  }
}
