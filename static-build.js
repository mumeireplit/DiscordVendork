import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 依存関係のインストール
console.log('依存関係をインストール中...');
execSync('npm ci', { stdio: 'inherit' });

// ディレクトリ構造の作成
console.log('ディレクトリ構造を作成中...');
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(distDir, 'public');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// クライアントのビルド（esbuildを使用）
console.log('クライアントのビルド処理を実行中...');
try {
  // メインエントリポイントをビルド
  execSync('npx esbuild client/src/main.tsx --bundle --minify --sourcemap --target=es2020 --outfile=dist/public/main.js', {
    stdio: 'inherit'
  });

  // CSSもバンドル
  execSync('npx esbuild client/src/index.css --bundle --minify --outfile=dist/public/main.css', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  console.log('クライアントビルド完了');
} catch (error) {
  console.error('クライアントビルドエラー:', error);
  process.exit(1);
}

// 必要なHTMLファイルを生成
console.log('HTMLファイルを生成中...');
const indexHtml = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Discord Vending Bot</title>
    <link rel="stylesheet" href="/main.css" />
    <script type="module" src="/main.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'index.html'), indexHtml);

// サーバービルド
console.log('サーバーをビルド中...');
try {
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
    stdio: 'inherit'
  });
  console.log('サーバービルド完了');
} catch (error) {
  console.error('サーバービルドエラー:', error);
  process.exit(1);
}

// 静的アセットをコピー
console.log('静的アセットをコピー中...');
if (fs.existsSync(path.join(__dirname, 'client', 'public'))) {
  // 再帰的にディレクトリをコピーする関数
  function copyDir(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  try {
    copyDir(
      path.join(__dirname, 'client', 'public'),
      publicDir
    );
  } catch (error) {
    console.warn('静的アセットのコピー中にエラーが発生しました:', error);
  }
}

// サーバーが静的ファイルを配信するための設定
console.log('サーバー設定ファイルを作成中...');

// .env設定（必要に応じて）
fs.writeFileSync(path.join(__dirname, '.env.production'), `
NODE_ENV=production
PORT=10000
`);

console.log('ビルド完了！');