const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { PNG } = require('pngjs');

// Configuration
const W = 640;
const H = 360;
const FPS = 16;
const DURATION = 8;
const TOTAL_FRAMES = FPS * DURATION; // 128 frames

console.log(`Building flawless transparent assets: ${W}x${H} @ ${FPS}fps (${TOTAL_FRAMES} frames)...`);

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
}

// 1. Process Video to RGBA frame buffer
async function processVideo(inputMp4, giftType, outputWebm, outputApng) {
  console.log(`\n=== Processing ${giftType} ===`);
  const tempDir = path.join(__dirname, `temp_frames_${giftType}`);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  console.log(`1. Extracting raw frames from ${inputMp4}...`);
  await runCommand('ffmpeg', [
    '-y',
    '-i', inputMp4,
    '-t', String(DURATION),
    '-r', String(FPS),
    '-vf', `scale=${W}:${H}:flags=lanczos`,
    path.join(tempDir, 'frame_%04d.png')
  ]);

  console.log('2. Removing checkerboard background with pixel-precision keying...');
  const frameFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png')).sort();

  for (let fIdx = 0; fIdx < frameFiles.length; fIdx++) {
    const filePath = path.join(tempDir, frameFiles[fIdx]);
    const srcPng = PNG.sync.read(fs.readFileSync(filePath));
    const outPng = new PNG({ width: W, height: H });

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (W * y + x) * 4;
        let r = srcPng.data[idx];
        let g = srcPng.data[idx + 1];
        let b = srcPng.data[idx + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        let alpha = 255;

        // Extreme edge fade (removes frame boundary AI lines)
        const edgeDistX = Math.min(x, W - 1 - x);
        const edgeDistY = Math.min(y, H - 1 - y);
        if (edgeDistX < 8 || edgeDistY < 6) {
          alpha = 0;
          outPng.data[idx] = r;
          outPng.data[idx + 1] = g;
          outPng.data[idx + 2] = b;
          outPng.data[idx + 3] = 0;
          continue;
        }

        if (giftType === 'dragon') {
          // Medium-grey checkerboard
          const isGreyR = (r >= 105 && r <= 165);
          const isGreyG = (g >= 105 && g <= 170);

          if (chroma < 18 && lum >= 100 && lum <= 170) {
            alpha = 0;
          } else if (isGreyR && isGreyG && (b - r < 75 || b < 200)) {
            alpha = 0;
          } else if (isGreyR && isGreyG && b >= 200 && b - r >= 75) {
            // Glowing cyan/blue flame over checkerboard
            const factor = Math.min(1.0, (b - 195) / 55);
            alpha = Math.round(factor * 255);
            r = Math.max(0, Math.round((r - 128) * 1.6));
            g = Math.min(255, Math.max(0, Math.round((g - 110) * 1.8)));
            b = 255;
          } else if (chroma < 28 && lum >= 95 && lum <= 175) {
            alpha = 0;
          } else {
            alpha = 255;
          }
        } else if (giftType === 'galaxy') {
          // Light grey / white checkerboard
          const isLightBg = (r >= 170 && g >= 170 && lum >= 175);
          if (isLightBg) {
            if (chroma < 60 || b - r < 75) {
              alpha = 0;
            } else {
              const factor = Math.min(1.0, (b - r - 70) / 40);
              alpha = Math.round(factor * 255);
            }
          } else if (lum >= 170 && chroma < 30) {
            alpha = 0;
          } else {
            alpha = 255;
          }
        } else if (giftType === 'mosquito') {
          // Light grey / white checkerboard
          const isLightBg = (r >= 180 && g >= 180 && lum >= 180);
          if (isLightBg) {
            if (chroma < 55 || b - r < 60) {
              alpha = 0;
            } else {
              const factor = Math.min(1.0, (b - r - 55) / 45);
              alpha = Math.round(factor * 255);
            }
          } else if (lum >= 185 && chroma < 28) {
            alpha = 0;
          } else {
            alpha = 255;
          }
        }

        outPng.data[idx] = r;
        outPng.data[idx + 1] = g;
        outPng.data[idx + 2] = b;
        outPng.data[idx + 3] = alpha;
      }
    }

    // Single-pixel noise filter
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = (W * y + x) * 4;
        if (outPng.data[idx + 3] > 0) {
          let neighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (outPng.data[((y + dy) * W + (x + dx)) * 4 + 3] > 20) neighbors++;
            }
          }
          if (neighbors <= 2) {
            outPng.data[idx + 3] = 0;
          }
        }
      }
    }

    fs.writeFileSync(filePath, PNG.sync.write(outPng));
  }

  console.log(`3. Encoding clean WebM (VP9 alpha) to ${outputWebm}...`);
  await runCommand('ffmpeg', [
    '-y',
    '-r', String(FPS),
    '-i', path.join(tempDir, 'frame_%04d.png'),
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-b:v', '1800k',
    outputWebm
  ]);

  console.log(`4. Encoding clean APNG to ${outputApng}...`);
  await runCommand('ffmpeg', [
    '-y',
    '-r', String(FPS),
    '-i', path.join(tempDir, 'frame_%04d.png'),
    '-plays', '0',
    outputApng
  ]);

  // Clean temp frames
  for (const f of frameFiles) fs.unlinkSync(path.join(tempDir, f));
  fs.rmdirSync(tempDir);
  console.log(`✓ ${giftType} processing complete!`);
}

module.exports = { processVideo };
