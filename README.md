# kensyo - Cloud Run SIGTERM / Graceful Shutdown 検証

Cloud Run 上で Dockerfile の `CMD` パターンによって SIGTERM の伝搬と graceful shutdown の挙動がどう変わるかを検証するアプリです。

## 検証結果

NestJS + TypeScript のアプリを Cloud Run にデプロイし、`/slow?duration=30` にリクエスト中に新リビジョンをデプロイして SIGTERM の到達を確認しました。

| CMD パターン | PID | SIGTERM 到達 | graceful shutdown |
| --- | --- | --- | --- |
| `node dist/main` (exec form 直接) | 1 | 到達 | **成功** |
| `npm start` (npm v10.9.7 / node:22) | 13 | 未到達 | **失敗** |
| `npm start` (npm v11.11.0 / node:24) | 13 | 未到達 | **失敗** |
| `yarn start` (yarn v1.22.22) | 13 | 未到達 | **失敗** |
| `yarn start` (yarn v4.13.0 Berry) | 13 | 到達 | **成功** |

**結論**: `CMD ["node", "dist/main"]` で node を直接 PID 1 として起動するのが最も確実です。

## 構成

```
src/
├── main.ts              # enableShutdownHooks() で SIGTERM を捕捉
├── app.module.ts
├── app.controller.ts    # GET / (ヘルスチェック) / GET /slow?duration=N (長時間処理)
├── app.service.ts       # BeforeApplicationShutdown / OnApplicationShutdown ライフサイクル
└── logger.ts            # Cloud Logging 構造化ログ (JSON stdout)
Dockerfile               # --build-arg で PKG_MANAGER / CMD_PATTERN を切り替え可能
cloudbuild.yaml           # Cloud Build → Artifact Registry → Cloud Run
```

## ローカルでの検証

```bash
npm install
npm run build

# Docker ビルド（パターン切り替え）
docker build --build-arg CMD_PATTERN=direct -t signal-test:direct .
docker build --build-arg CMD_PATTERN=npm    -t signal-test:npm .
docker build --build-arg PKG_MANAGER=yarn --build-arg CMD_PATTERN=yarn -t signal-test:yarn .

# 起動
docker run -d --name test -p 8080:8080 signal-test:direct

# SIGTERM テスト
curl "http://localhost:8080/slow?duration=15" &
sleep 1
docker stop test
docker logs test
```

## Cloud Run へのデプロイ

```bash
# 事前準備
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create cloud-run-test \
  --repository-format=docker --location=asia-northeast1

# ビルド & プッシュ
IMAGE="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-test/signal-test:latest"
docker build --build-arg CMD_PATTERN=direct -t $IMAGE --platform linux/amd64 .
docker push $IMAGE

# デプロイ（最低スペック）
gcloud run deploy signal-test \
  --image=$IMAGE \
  --region=asia-northeast1 \
  --cpu=1 --memory=256Mi \
  --min-instances=0 --max-instances=1 \
  --allow-unauthenticated

# SIGTERM 検証：slow リクエスト中に再デプロイ
curl "https://<SERVICE_URL>/slow?duration=30" &
gcloud run deploy signal-test --image=$IMAGE --region=asia-northeast1

# Cloud Logging で確認
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="signal-test"' \
  --limit=20 --format=json
```

## エンドポイント

| パス | 説明 |
| --- | --- |
| `GET /` | ステータス（PID, uptime, activeRequests） |
| `GET /slow?duration=N` | N 秒間スリープしてからレスポンスを返す |

## Dockerfile の CMD パターン

`--build-arg CMD_PATTERN=<pattern>` で切り替え可能：

| パターン | 起動コマンド | 説明 |
| --- | --- | --- |
| `direct` (デフォルト) | `node dist/main` | node が PID 1 になる（推奨） |
| `npm` | `npm start` | npm 経由（/bin/sh が挟まる） |
| `yarn` | `yarn start` | yarn 経由（PKG_MANAGER=yarn も必要） |
| `shell` | `/bin/sh -c "node dist/main"` | shell form の検証 |
