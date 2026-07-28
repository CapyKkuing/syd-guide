import { FixtureTravelGuideDataSource } from "../data/fixture/fixtureDataSource";

export function createSampleDataSource(
  clock: () => Date = () => new Date()
): FixtureTravelGuideDataSource {
  return new FixtureTravelGuideDataSource(clock);
}

export const sampleDataSource = createSampleDataSource();
