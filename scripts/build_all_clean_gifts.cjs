const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PNG } = require('pngjs');
const { processVideo } = require('./asset_processor.cjs');

async function main() {
  const publicGifts = path.join(__dirname, 'apps', 'admin', 'public', 'gifts');

  // Find source video files in gifts/
  const giftsFiles = fs.readdirSync(path.join(__dirname, 'gifts'));
  const dragonMp4 = path.join(__dirname, 'gifts', giftsFiles.find(f => f.startsWith('Animated_dragon')));
  const galaxyMp4 = path.join(__dirname, 'gifts', giftsFiles.find(f => f.startsWith('Cosmic_galaxy_gift_box') && f.includes('205328')) || giftsFiles.find(f => f.startsWith('Cosmic_galaxy')));
  const mosquitoMp4 = path.join(__dirname, 'gifts', giftsFiles.find(f => f.startsWith('Tropical_mosquito')));

  console.log('Sources:', { dragonMp4, galaxyMp4, mosquitoMp4 });

  // 1. DRAGON
  console.log('\n>>> BUILDING DRAGON ASSETS <<<');
  const dragonDir = path.join(publicGifts, 'dragon');
  await processVideo(
    dragonMp4,
    'dragon',
    path.join(dragonDir, 'animation.webm'),
    path.join(dragonDir, 'animation.apng')
  );
  // Update dragon icon with clean frame
  execSync(`ffmpeg -y -i "test_dragon_clean_3s.png" -vf "scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000" "${path.join(dragonDir, 'icon.webp')}"`);
  console.log('✓ Dragon icon updated to clean transparent WebP');

  // 2. SUPER GALAXY
  console.log('\n>>> BUILDING SUPER GALAXY ASSETS <<<');
  const galaxyDir = path.join(publicGifts, 'super-galaxy');
  await processVideo(
    galaxyMp4,
    'galaxy',
    path.join(galaxyDir, 'animation.webm'),
    path.join(galaxyDir, 'animation.apng')
  );
  // Update galaxy icon
  execSync(`ffmpeg -y -i "test_galaxy_clean_v2.png" -vf "scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000" "${path.join(galaxyDir, 'icon.webp')}"`);
  console.log('✓ Galaxy icon updated to clean transparent WebP');

  // 3. TROPICAL MOSQUITO
  console.log('\n>>> BUILDING TROPICAL MOSQUITO ASSETS <<<');
  const mosquitoDir = path.join(publicGifts, 'tropical-mosquito');
  await processVideo(
    mosquitoMp4,
    'mosquito',
    path.join(mosquitoDir, 'animation.webm'),
    path.join(mosquitoDir, 'animation.apng')
  );
  // Update mosquito icon
  execSync(`ffmpeg -y -i "test_mosquito_clean.png" -vf "scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000" "${path.join(mosquitoDir, 'icon.webp')}"`);
  console.log('✓ Mosquito icon updated to clean transparent WebP');

  // 4. ROSE
  console.log('\n>>> BUILDING ROSE ASSETS <<<');
  const roseDir = path.join(publicGifts, 'rose');
  // Update rose icon
  execSync(`ffmpeg -y -i "test_rose_perfect_v2.png" -vf "scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000" "${path.join(roseDir, 'icon.webp')}"`);

  // Build animated blooming transparent rose (48 frames @ 16fps = 3 seconds)
  const tempRoseDir = path.join(__dirname, 'temp_rose_frames');
  if (!fs.existsSync(tempRoseDir)) fs.mkdirSync(tempRoseDir, { recursive: true });

  const roseSrc = PNG.sync.read(fs.readFileSync('test_rose_perfect_v2.png'));
  const rw = 400;
  const rh = 400;

  for (let f = 0; f < 48; f++) {
    const progress = f / 47; // 0 to 1
    // Animation curve: enters blooming, scales from 0.7 to 1.05 then settles to 1.0, rotates slightly, then fades out at end
    let scale = 0.7 + 0.35 * Math.sin(progress * Math.PI * 0.85);
    if (progress > 0.8) {
      scale *= 1.0 - (progress - 0.8) * 1.5; // gentle dissolve
    }
    const opacity = progress > 0.85 ? Math.max(0, 1.0 - (progress - 0.85) / 0.15) : Math.min(1.0, progress * 5);
    const rotation = Math.sin(progress * Math.PI * 2) * 0.05; // subtle tilt

    const framePng = new PNG({ width: rw, height: rh });

    // Center coordinates
    const cx = rw / 2;
    const cy = rh / 2;

    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        // Reverse transform
        const relX = (dx - cx) / scale;
        const relY = (dy - cy) / scale;

        // Apply slight rotation
        const cosR = Math.cos(-rotation);
        const sinR = Math.sin(-rotation);
        const srcX = Math.round(cx + (relX * cosR - relY * sinR) * (roseSrc.width / rw));
        const srcY = Math.round(cy + (relX * sinR + relY * cosR) * (roseSrc.height / rh));

        const targetIdx = (rh * dy + dx) * 4;

        if (srcX >= 0 && srcX < roseSrc.width && srcY >= 0 && srcY < roseSrc.height) {
          const sIdx = (roseSrc.width * srcY + srcX) * 4;
          framePng.data[targetIdx] = roseSrc.data[sIdx];
          framePng.data[targetIdx + 1] = roseSrc.data[sIdx + 1];
          framePng.data[targetIdx + 2] = roseSrc.data[sIdx + 2];
          framePng.data[targetIdx + 3] = Math.round(roseSrc.data[sIdx + 3] * opacity);
        } else {
          framePng.data[targetIdx + 3] = 0;
        }
      }
    }

    const frameFile = path.join(tempRoseDir, `frame_${String(f + 1).padStart(4, '0')}.png`);
    fs.writeFileSync(frameFile, PNG.sync.write(framePng));
  }

  // Encode Rose WebM and APNG
  execSync(`ffmpeg -y -r 16 -i "${path.join(tempRoseDir, 'frame_%04d.png')}" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 1200k "${path.join(roseDir, 'animation.webm')}"`);
  execSync(`ffmpeg -y -r 16 -i "${path.join(tempRoseDir, 'frame_%04d.png')}" -plays 0 "${path.join(roseDir, 'animation.apng')}"`);

  // Clean rose temp
  for (const rf of fs.readdirSync(tempRoseDir)) fs.unlinkSync(path.join(tempRoseDir, rf));
  fs.rmdirSync(tempRoseDir);
  console.log('✓ Rose transparent animation complete!');

  // Mirror all public gifts to root gifts/
  for (const g of ['rose', 'dragon', 'super-galaxy', 'tropical-mosquito']) {
    const srcDir = path.join(publicGifts, g);
    const destDir = path.join(__dirname, 'gifts', g);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    for (const f of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
    }
  }

  console.log('\n=============================================');
  console.log('ALL GIFTS ASSETS RE-ENCODED WITH ZERO BACKGROUND!');
  console.log('=============================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
