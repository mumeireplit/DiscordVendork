const { execSync } = require('child_process');

console.log('Installing firebase modules in dist folder...');
try {
  // パッケージをインストール
  execSync('npm install firebase firebase-admin --production', {
    cwd: './dist',
    stdio: 'inherit'
  });
  console.log('Firebase modules installed successfully!');
} catch (error) {
  console.error('Failed to install Firebase modules:', error);
  process.exit(1);
}