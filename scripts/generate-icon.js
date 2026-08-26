const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ICON_SIZES = [16, 32, 64, 128, 256, 512];

async function generateIcon() {
  const iconSvg = path.join(__dirname, '../assets/icon.svg');
  const iconsetDir = path.join(__dirname, '../assets/icon.iconset');

  if (!fs.existsSync(iconSvg)) {
    console.error('icon.svg not found');
    process.exit(1);
  }

  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
  fs.mkdirSync(iconsetDir, { recursive: true });

  console.log('Generating icon sizes...');

  for (const size of ICON_SIZES) {
    const output1x = path.join(iconsetDir, `icon_${size}x${size}.png`);
    const output2x = path.join(iconsetDir, `icon_${size}x${size}@2x.png`);

    try {
      await sharp(iconSvg)
        .resize(size, size)
        .png()
        .toFile(output1x);
      console.log(`  Generated ${size}x${size}`);
    } catch (e) {
      console.error(`  Failed to generate ${size}x${size}:`, e.message);
    }

    try {
      const size2x = size * 2;
      await sharp(iconSvg)
        .resize(size2x, size2x)
        .png()
        .toFile(output2x);
      console.log(`  Generated ${size}x${size}@2x`);
    } catch (e) {
      console.error(`  Failed to generate ${size}x${size}@2x:`, e.message);
    }
  }

  const icnsPath = path.join(__dirname, '../assets/icon.icns');
  try {
    console.log('Converting to icns...');
    const { execSync } = require('child_process');
    execSync(`iconutil -c icns ${iconsetDir} -o ${icnsPath}`, { stdio: 'inherit' });
    console.log('Icon generated successfully!');
  } catch (e) {
    console.log('iconutil not available, skipping icns generation');
  }

  fs.rmSync(iconsetDir, { recursive: true });
}

generateIcon();
