const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const giftDirs = ['rose', 'dragon', 'super-galaxy', 'tropical-mosquito'];

const publicBase = path.join(__dirname, 'apps', 'admin', 'public', 'gifts');
for (const dir of giftDirs) {
  const p = path.join(publicBase, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

console.log('Created directories in apps/admin/public/gifts');

// Find source video files in gifts/
const giftsFiles = fs.readdirSync(path.join(__dirname, 'gifts'));
const dragonVideo = giftsFiles.find(f => f.startsWith('Animated_dragon'));
const galaxyVideo = giftsFiles.find(f => f.startsWith('Cosmic_galaxy') && f.includes('205328')) || giftsFiles.find(f => f.startsWith('Cosmic_galaxy'));
const galaxyStreamVideo = giftsFiles.find(f => f.startsWith('Super_Galaxy_animated'));
const mosquitoVideo = giftsFiles.find(f => f.startsWith('Tropical_mosquito'));

console.log('Source files found:', { dragonVideo, galaxyVideo, mosquitoVideo });

// 1. EXTRACT SOUNDS
try {
  if (dragonVideo) {
    execSync(`ffmpeg -y -i "gifts/${dragonVideo}" -vn -c:a libmp3lame -b:a 128k "${path.join(publicBase, 'dragon', 'sound.mp3')}"`);
    console.log('Created dragon sound.mp3');
  }
  if (galaxyVideo) {
    execSync(`ffmpeg -y -i "gifts/${galaxyVideo}" -vn -c:a libmp3lame -b:a 128k "${path.join(publicBase, 'super-galaxy', 'sound.mp3')}"`);
    console.log('Created super-galaxy sound.mp3');
  }
  if (mosquitoVideo) {
    execSync(`ffmpeg -y -i "gifts/${mosquitoVideo}" -vn -c:a libmp3lame -b:a 128k "${path.join(publicBase, 'tropical-mosquito', 'sound.mp3')}"`);
    console.log('Created tropical-mosquito sound.mp3');
  }
  // Rose romantic chime
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=1046.5:duration=2.5,afade=t=out:st=0.8:d=1.7" -c:a libmp3lame -b:a 128k "${path.join(publicBase, 'rose', 'sound.mp3')}"`);
  console.log('Created rose sound.mp3');
} catch (e) {
  console.error('Audio extraction error:', e.message);
}
