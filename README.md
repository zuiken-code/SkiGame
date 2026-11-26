# 雪山おにごっこ

スマホのブラウザーで遊べる、滑走距離を競う3Dスキー鬼ごっこです。コースをタップすると3人の追手と滑り出します。両手を伸ばす追手を急ターンで転ばせたり、岩や木に誘導して振り切ったりできます。岩や木にぶつかるか、追手の手に触れると、その場で滑走終了です。

## 同じ Wi-Fi のスマホで遊ぶ

PC に **Node.js 24 以上**と Git を用意します。下記は Windows の PowerShell 用です。macOS・Linux では `npm.cmd` を `npm`、`npx.cmd` を `npx` に読み替えてください。ローカルテストは Cloudflare アカウントなしで行えます。

```powershell
git clone https://github.com/zuiken-code/SkiGame.git
cd SkiGame
npm.cmd ci
npm.cmd run play
```

1. `play` がローカル D1 にマイグレーションを適用し、型チェックとビルドを行い、Wrangler を **0.0.0.0:8788** で起動します。
2. PC とスマホを同じ Wi-Fi に接続します。PC で `ipconfig` を実行し、Wi-Fi アダプターの IPv4 アドレスを確認します。
3. たとえばアドレスが `192.168.1.20` なら、スマホで `http://192.168.1.20:8788` を開きます。PC からは `http://localhost:8788` を開けます。
4. コースをタップして開始し、終了画面で名前を入力して「登録」を押します。別のスマホでも同じ PC の URL を開くと、同じランキングに記録できます。「結果を共有」からは滑走距離とゲームの URL を共有・コピーできます。LAN の URL は同じネットワーク内で開けます。

起動したターミナルでは `Ctrl+C` で停止できます。再起動後もローカル D1 の記録は `.wrangler/state/` に残ります。PC では開けてスマホで開けない場合は、Wi-Fi の端末間通信、Windows ファイアウォールのプライベートネットワークでの許可、Wi-Fi 側の IPv4 を選んでいるかを確認してください。

### 操作

起動時は新版です。スタート画面左上の「旧版」で以前のコースに切り替えられます。「新版」で加速アイテムとジャンプ台のあるコースに戻れます。

| 操作 | スマホ | キーボード |
| --- | --- | --- |
| ターン | コースの好きな位置を押し、そこから左右へドラッグ | ← / → または A / D |
| 減速 | 押した位置から手前にドラッグ。指を離すと解除 | ↓ または S |
| 一時停止・再開 | 右上の一時停止ボタン、再開ボタン | Esc または P |

ページが非表示になると一時停止します。滑走の途中でスタート画面に戻った場合は記録対象外です。WebGL 2 対応のブラウザーを使ってください。

後ろや横の追手が約3.8m以内に近づくと、こちらに両手を伸ばします。手が届く前に急ターンでかわすとすぐに転び、つかみ損ねたときも動作の終わりに転びます。転倒すると約1.8秒間止まります。コース端まで横移動しても前進速度を保ちます。

金色のアイテムを拾うと約2.6秒間加速します。水色のジャンプ台を踏むと勢いよく高さ約10mまで飛び上がり、飛び出したときの前進速度を保って約3秒間滑空します。空中でもジョイスティックで左右移動と減速ができ、コースの端で止まります。滑空中と着地後1秒は障害物や追手に当たっても無敵です。スキーヤーを包むバリアと画面の「無敵」表示で効果を確認できます。最初のアイテムは約55m、最初のジャンプ台は約104m付近です。以降はコースにランダムな間隔で現れます。

### コードを変えながら試す

ホットリロードを使う場合は、同じリポジトリでターミナルを2つ開きます。最初のビルドで `dist/` を用意します。

```powershell
# ターミナル1。Worker とローカル D1 を起動
npm.cmd run db:local
npm.cmd run build
npm.cmd run api
```

```powershell
# ターミナル2。Vite を Wi-Fi に公開
npm.cmd run dev
```

スマホで `http://<PCのWi-FiのIPv4>:5173` を開きます。Vite は `/api` を PC 内の `127.0.0.1:8789` へ転送します。ブラウザーの保存領域は URL のホスト・ポート単位なので、同一プレーヤーとしてテストしたいときは毎回同じ URL を使います。

## ランキングの仕様

- ランキングの「新版」「旧版」で、それぞれの上位記録と自分の順位を確認できます。ローカルのベストもバージョン別です。

- 表示名は1〜16文字です。ログインは不要です。クライアントがランダムな端末トークンを生成し、ブラウザーのローカルストレージに保存します。名前が同じ別端末は別プレーヤーです。
- サーバー側は1プレーヤーにつき最高距離を整数メートルで1件保存します。短い記録で再登録しても自己ベストを維持し、新しく指定した表示名を適用します。
- 同距離は同順位（1位、1位、3位）です。同距離内では、その距離に先に到達した記録を先に表示します。ランキング画面では上位10人と自分の順位を確認できます。
- スタート画面の自己ベスト、滑走回数、振り切った追手の累計は端末にも保存します。開始時にサーバーと接続できなかった滑走も、端末の記録に残ります。端末変更やブラウザーデータの削除後は新しいプレーヤーになります。

## 構成とファイルの役割

描画・入力・物理演算・スコア保存を別々に追える構成です。描画と衝突判定は同じコース座標を参照します。

| パス | 役割 |
| --- | --- |
| `index.html`、`src/main.tsx` | ページの入口、React の起動、ローカル配信フォントと共通 CSS の読み込み |
| `src/App.tsx` | ランキングと遊び方の表示、滑走単位のセッション、結果の登録 |
| `src/game/edition.ts` | ゲームとランキングで使う新旧バージョンの名前 |
| `src/components/Game/StartOverlay.tsx` | コースに重ねるタップ開始画面、自己ベスト、効果音切り替え |
| `src/components/Ranking/Ranking.tsx` | スコア一覧、同順位の表示、自分の順位、取得失敗時の再読み込み |
| `src/components/Dialogs/Dialogs.tsx` | 遊び方、結果と再挑戦、ランキング登録と結果共有 |
| `src/components/Game/GameScreen.tsx` | ゲームのフレーム更新、HUD、一時停止、終了判定の通知 |
| `src/components/Game/SteeringSurface.tsx` | 指を置いた位置に現れるスティック、ポインターキャプチャ、キーボード入力 |
| `src/components/Game/useGameSound.ts`、`game.css` | Web Audio の効果音とプレイ画面のレイアウト |
| `src/game/course.ts` | コース中心線、シード付き障害物配置、各列の通過可能なレーンの確保 |
| `src/game/features.ts` | 加速アイテムとジャンプ台の寸法、効果時間、滑空の高度と速度 |
| `src/game/joystick.ts` | ドラッグ入力の正規化と、横ターン時の意図しないブレーキの抑制 |
| `src/game/reach.ts` | 両手の届く位置、腕を伸ばす長さ、手と選手の接触判定 |
| `src/game/simulation.ts` | 60Hz 固定ステップの滑走、減速、追手の出現・追跡・転倒・衝突、距離計測 |
| `src/game/simulation.test.mjs` | フレームレート差、衝突、追手の誘導と転倒、捕獲後の距離固定を検証 |
| `tests/leaderboard.test.mjs` | 実際のマイグレーションと API ハンドラーを SQLite で動かし、同順位・圏外順位・再送と自己ベスト保持を検証 |
| `src/scene/SkiScene.tsx` | React Three Fiber の Canvas、描画の開始・停止と WebGL のエラー処理 |
| `src/scene/environment/world.ts` | カメラと背景、地形、障害物、選手の座標を毎フレーム同期 |
| `src/scene/environment/piste.ts`、`tracks.ts` | カーブに沿う雪面メッシュと滑走跡 |
| `src/scene/environment/instances.ts` | 樹木・柵・追手など繰り返す物体のインスタンス描画 |
| `src/scene/models/geometry.ts`、`skier.ts`、`courseObjects.ts` | 共通の形状部品、選手、岩・木・山・コース設備の3Dモデルを生成 |
| `src/scene/models/courseFeatures.ts` | 加速アイテムとジャンプ台の3Dモデルを生成 |
| `src/scene/models/protectionBarrier.ts` | 無敵中にスキーヤーを包むバリアを描画 |
| `src/services/profile.ts` | ローカル統計、表示名、サウンド設定の保存と読み込み |
| `src/services/leaderboard.ts` | 匿名トークンの生成・保持、API 呼び出し、タイムアウト、応答の型確認 |
| `src/styles/base.css`、`ranking.css` | 配色、共通のダイアログとボタン、ランキングのレイアウト |
| `worker/index.ts` | Worker の Fetch ハンドラー、API ルーティング、リクエスト検証、D1 アクセス |
| `migrations/0001_leaderboard.sql` | 滑走と自己ベストのテーブル、順位用インデックス、自己ベスト更新のトリガー |
| `public/icons/`、`public/manifest.webmanifest` | ブラウザーのタブとホーム画面で使うゲームアイコン |
| `package.json`、`package-lock.json` | 開発コマンド、依存パッケージと再現可能なバージョン |
| `vite.config.ts` | Vite の React プラグイン、LAN 待ち受け、API プロキシ、配布用ライセンス出力 |
| `tsconfig.json`、`tsconfig.worker.json` | ブラウザー用と Cloudflare ランタイム用の型チェック |
| `wrangler.jsonc` | Worker のエントリーポイント、静的アセット、API 経路、D1 バインディング `DB` |
| `.gitignore` | ビルド出力、依存パッケージ、ローカル D1、環境変数ファイルを Git の管理対象から除外 |

## レビューと動作確認

```powershell
npm.cmd test
npm.cmd run build
```

**調整箇所**　前進速度、追手の追加間隔と転倒時間は `simulation.ts`、手を伸ばす距離と時間は `reach.ts`、コース幅と障害物の密度は `course.ts`、カメラは `world.ts`、ジョイスティックの可動半径は `joystick.ts` です。

**登録の流れ**　滑走開始時に `POST /api/runs` で開始時刻付きの滑走 ID を取得します。終了時の「登録」で `POST /api/leaderboard` に滑走 ID・表示名・距離を送信します。`GET /api/leaderboard` は `entries`（上位10人）と `me`（本人の記録または `null`）を返します。トークンはリクエストヘッダーに渡し、D1 ではハッシュで識別します。

**整合性**　同じ内容の再送は同じ滑走として扱います。終了済みの滑走 ID を使った別内容の登録は拒否します。滑走の確定と自己ベスト更新は SQL トリガーで一体化しています。サーバーは滑走の所有者・有効期限（24時間）・経過時間に対する距離の上限を照合します。スキーの軌跡の判定はクライアント側です。

**実機での確認例**　2台で別々の名前と距離を登録し、お互いの記録と自分の順位を確認します。同じ端末で短い距離を再登録し、自己ベストが保持されることも確認できます。画面の端からドラッグ、指を押したまま別の指でタッチ、タブ切り替えからの再開は、実際の端末で確認したい操作です。

## Cloudflare Workers に GitHub 連携で公開

GitHub の `zuiken-code/SkiGame` を Cloudflare Worker `skigame` に接続します。`main` への push やマージで Workers Builds がビルドとデプロイを実行します。ゲーム画面は `dist/` の静的アセットとして配信され、`/api/*` は同じ Worker が処理します。[Workers Builds の設定](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)・[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/binding/)

### 1. 本番 D1 の準備

`wrangler.jsonc` の `DB` は旧版用の `ski-game` です。これまでの本番記録はこのデータベースに残ります。新版の本番記録は `DB_NEW` の `ski-game-new` に保存します。初回と、新しい SQL マイグレーションを含む更新の公開前に、リポジトリのルートで以下を実行します。

```powershell
npm.cmd ci
npx.cmd wrangler login
npx.cmd wrangler d1 migrations apply ski-game --remote
npx.cmd wrangler d1 migrations apply ski-game-new --remote
```

既存のスキーマには、未適用のマイグレーションだけが反映されます。ローカルのマイグレーションと記録は `.wrangler/state/` に保存されます。[D1 マイグレーション](https://developers.cloudflare.com/d1/reference/migrations/)

### 2. Workers Builds の設定

Cloudflare ダッシュボードの **Workers & Pages → skigame → Settings → Build** で、GitHub リポジトリを接続するか既存の接続を開きます。次の値で保存します。

| 設定 | 入力値 |
| --- | --- |
| Git repository | `zuiken-code/SkiGame` |
| Production branch | `main` |
| Root directory | 空欄（リポジトリのルート） |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable | `NODE_VERSION` に `24.22.1` |

配信元は `wrangler.jsonc` の `assets.directory` で指定しています。デプロイ後は `*.workers.dev` でゲームと両方のランキングを確認します。`/api/leaderboard?edition=new` と `/api/leaderboard?edition=classic` は、それぞれの `entries` と `me` を含む JSON を返します。

### 3. プルリクエストでテストする

本番へ反映する前に、作業ブランチを push して `main` 向けのプルリクエストを作ります。Workers Builds の **Enable Preview Builds** を有効にし、**Preview command** に `npx wrangler preview` を使うと、ブランチへの push でプレビューが更新されます。[Workers Builds のプレビュー設定](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)

プレビューのランキングは `wrangler.jsonc` の `previews.d1_databases` にある `ski-game-preview`（新版）と `ski-game-preview-classic`（旧版）に保存します。未適用の SQL がある場合は、プレビュー用 D1 にも適用してからテストします。手元からプレビューだけを再公開するときは、作業ブランチで `npm.cmd run build` の後に `npx.cmd wrangler preview` を実行します。[Worker Previews の設定](https://developers.cloudflare.com/workers/previews/configuration/)

### 4. 更新を本番へ公開する

ローカルで `npm.cmd test` と `npm.cmd run build` を通し、スマホで動作を確認してから `main` に反映します。ビルド・デプロイの結果は Worker の **Deployments** で確認できます。

Workers 無料プランと D1 の上限は公式ページを参照してください。ゲーム中の移動は端末で計算します。静的アセットへのリクエストは無料で、ランキング API の処理は Workers の使用量に含まれます。[Workers の料金](https://developers.cloudflare.com/workers/platform/pricing/)・[D1 の料金](https://developers.cloudflare.com/d1/platform/pricing/)
