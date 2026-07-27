import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const source =
  "stitch_sydney_travel_guidebook_extracted/stitch_sydney_travel_guidebook/sydney_travel_guide_logo/screen.png";

await mkdir("public/icons", { recursive: true });

for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}
