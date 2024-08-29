import { $ } from "bun";

const platforms = [
  { name: "linux-x64", target: "bun-linux-x64" },
  { name: "linux-arm64", target: "bun-linux-arm64" },
  { name: "macos-x64", target: "bun-darwin-x64" },
  { name: "macos-arm64", target: "bun-darwin-arm64" },
  { name: "windows-x64", target: "bun-windows-x64" },
];

async function buildForPlatform(platform: typeof platforms[0]) {
  console.log(`\x1b[34mBuilding ${platform.name} version...\x1b[0m`);
  await $`bun build ./src/index.ts --compile --outfile dist/fake-api-${platform.name} --target ${platform.target}`;
  console.log(`\x1b[32mCompleted ${platform.name} build\x1b[0m`);
}

async function build(targetPlatform?: string) {
  // Clean dist folder
  await $`rm -rf dist`;
  console.log("\x1b[32mCleaning completed\x1b[0m");

  if (targetPlatform) {
    const platform = platforms.find(p => p.name === targetPlatform);
    if (!platform) {
      throw new Error(`Invalid platform: ${targetPlatform}`);
    }
    await buildForPlatform(platform);
  } else {
    // Build for all platforms
    for (const platform of platforms) {
      await buildForPlatform(platform);
    }
  }

  console.log("\x1b[32mBuild completed\x1b[0m");
}

const targetPlatform = process.argv[2];
await build(targetPlatform);
