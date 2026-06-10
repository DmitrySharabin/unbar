// Regenerate PNG assets from the SVGs in assets/.
// High oversample + Lanczos + mild unsharp mask = crisp edges at every size.

import sharp from "sharp";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const ICON_SIZES = [16, 32, 48, 128];

async function writePng (pipeline, width, height, output) {
	await pipeline
		.resize(width, height, { kernel: "lanczos3", fastShrinkOnLoad: false })
		.sharpen({ sigma: 0.5 })
		.png({ compressionLevel: 9 })
		.toFile(join(root, output));

	console.log(output);
}

// One 1024×1024 master (8× the 128-unit viewBox), downscaled in parallel.
async function renderIcons () {
	const master = await sharp(join(root, "assets/icon.svg"), { density: 576 }).png().toBuffer();

	await Promise.all(
		ICON_SIZES.map(size => writePng(sharp(master), size, size, `src/icons/icon-${size}.png`)),
	);
}

// 3× density on the 440×280 viewBox → 1320×840 raster, downscaled to the store size.
async function renderTile () {
	const tile = sharp(join(root, "assets/tile.svg"), { density: 216 });
	await writePng(tile, 440, 280, "store/tile-440x280.png");
}

await Promise.all([renderIcons(), renderTile()]);
