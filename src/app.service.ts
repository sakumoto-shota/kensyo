import {
  Injectable,
  OnApplicationShutdown,
  BeforeApplicationShutdown,
} from "@nestjs/common";
import { logger } from "./logger";

@Injectable()
export class AppService
  implements OnApplicationShutdown, BeforeApplicationShutdown
{
  private activeRequests = 0;

  getStatus() {
    return {
      status: "ok",
      pid: process.pid,
      uptime: process.uptime(),
      activeRequests: this.activeRequests,
    };
  }

  async slowProcess(duration: number): Promise<Record<string, unknown>> {
    const requestId = Date.now();
    this.activeRequests++;

    logger.info("/slow 開始", { requestId, duration, activeRequests: this.activeRequests });

    await new Promise((resolve) => setTimeout(resolve, duration * 1000));

    this.activeRequests--;
    logger.info("/slow 完了", { requestId, activeRequests: this.activeRequests });

    return { requestId, duration, completed: true };
  }

  // SIGTERM 受信直後に呼ばれる（処理中リクエスト完了前）
  async beforeApplicationShutdown(signal?: string) {
    logger.warn("beforeApplicationShutdown", {
      signal,
      activeRequests: this.activeRequests,
    });
    logger.info("処理中リクエストの完了を待機します...");

    // 処理中リクエストが完了するまで待つ（最大 8 秒）
    const deadline = Date.now() + 8000;
    while (this.activeRequests > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (this.activeRequests > 0) {
      logger.error("タイムアウト: リクエストが未完了", {
        activeRequests: this.activeRequests,
      });
    } else {
      logger.info("全リクエスト完了");
    }
  }

  // アプリケーション終了時に呼ばれる
  async onApplicationShutdown(signal?: string) {
    logger.info("onApplicationShutdown", { signal });
    logger.info("Graceful shutdown 完了");
  }
}
