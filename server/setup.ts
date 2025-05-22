import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

// ロギング関数
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// 開発環境の場合はViteサーバーを設定
export async function setupDev(app: Express, server: Server) {
  if (process.env.NODE_ENV !== 'development') {
    return; // 開発環境以外では何もしない
  }

  try {
    // 動的にViteをインポート（本番環境ではインポートされない）
    const vite = await import('vite');
    const viteConfig = await import('../vite.config.js');
    
    const serverOptions = {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true,
    };

    const viteLogger = vite.createLogger();
    const viteServer = await vite.createServer({
      configFile: false,
      customLogger: {
        ...viteLogger,
        error: (msg, options) => {
          viteLogger.error(msg, options);
          process.exit(1);
        },
      },
      server: serverOptions,
      appType: "custom",
    });

    app.use(viteServer.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html",
        );

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        const page = await viteServer.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        viteServer.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } catch (error) {
    console.error('Viteのセットアップに失敗しました:', error);
  }
}

// 本番環境用の静的ファイル配信
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `ビルドディレクトリが見つかりません: ${distPath}、クライアントを先にビルドしてください`,
    );
  }

  app.use(express.static(distPath));

  // ファイルが存在しない場合はindex.htmlにフォールバック
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}