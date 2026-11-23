# 雪山おにごっこ

スマホのブラウザーで遊べる、滑走距離を競う3Dスキー鬼ごっこです。コースをタップすると3人の追手と滑り出します。両手を伸ばす追手を急ターンで転ばせたり、岩や木に誘導して振り切ったりできます。自分が障害物に当たると減速し、追手の手に触れると滑走終了です。

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

| 操作 | スマホ | キーボード |
| --- | --- | --- |
| ターン | コースの好きな位置を押し、そこから左右へドラッグ | ← / → または A / D |
| 減速 | 押した位置から手前にドラッグ。指を離すと解除 | ↓ または S |
| 一時停止・再開 | 右上の一時停止ボタン、再開ボタン | Esc または P |

ページが非表示になると一時停止します。滑走の途中でスタート画面に戻った場合は記録対象外です。WebGL 2 対応のブラウザーを使ってください。

後ろや横の追手が約3.8m以内に近づくと、こちらに両手を伸ばします。手が届く前に急ターンでかわすと、追手は約1.8秒間転倒します。コース端まで横移動しても前進速度を保ちます。

### コードを変えながら試す

ホットリロードを使う場合は、同じリポジトリでターミナルを2つ開きます。最初のビルドで `dist/` を用意します。

```powershell
# ターミナル1。Pages Functions とローカル D1 を起動
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
| `src/components/Game/StartOverlay.tsx` | コースに重ねるタップ開始画面、自己ベスト、効果音切り替え |
| `src/components/Ranking/Ranking.tsx` | スコア一覧、同順位の表示、自分の順位、取得失敗時の再読み込み |
| `src/components/Dialogs/Dialogs.tsx` | 遊び方、結果と再挑戦、ランキング登録と結果共有 |
| `src/components/Game/GameScreen.tsx` | ゲームのフレーム更新、HUD、一時停止、終了判定の通知 |
| `src/components/Game/SteeringSurface.tsx` | 指を置いた位置に現れるスティック、ポインターキャプチャ、キーボード入力 |
| `src/components/Game/useGameSound.ts`、`game.css` | Web Audio の効果音とプレイ画面のレイアウト |
| `src/game/course.ts` | コース中心線、シード付き障害物配置、各列の通過可能なレーンの確保 |
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
| `src/services/profile.ts` | ローカル統計、表示名、サウンド設定の保存と読み込み |
| `src/services/leaderboard.ts` | 匿名トークンの生成・保持、API 呼び出し、タイムアウト、応答の型確認 |
| `src/styles/base.css`、`ranking.css` | 配色、共通のダイアログとボタン、ランキングのレイアウト |
| `functions/api/[[endpoint]].ts` | Pages Functions の HTTP ルート、リクエスト検証、D1 アクセス |
| `migrations/0001_leaderboard.sql` | 滑走と自己ベストのテーブル、順位用インデックス、自己ベスト更新のトリガー |
| `public/ridge.svg` | ファビコン |
| `public/_routes.json` | Functions を呼ぶ経路を `/api/*` に限定 |
| `package.json`、`package-lock.json` | 開発コマンド、依存パッケージと再現可能なバージョン |
| `vite.config.ts` | Vite の React プラグイン、LAN 待ち受け、API プロキシ、配布用ライセンス出力 |
| `tsconfig.json`、`tsconfig.functions.json` | ブラウザー用と Cloudflare ランタイム用の型チェック |
| `wrangler.jsonc` | Pages の配信先ディレクトリ、D1 のバインディング `DB` とマイグレーション先 |
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

## 実機テスト・調整が済んだ後の Cloudflare 公開

GitHub への push と本番公開は別操作です。以下は **本番へ公開する段階** の手順です。リポジトリのルートから実行します。

1. 初回のみ、Cloudflare にログインして D1 を作成します。

   ```powershell
   npx.cmd wrangler login
   npx.cmd wrangler d1 create ski-game
   ```

2. 出力された本番 D1 の UUID を `wrangler.jsonc` の `d1_databases[0].database_id` に設定します。初期値はローカルテスト用です。バインディング名は `DB` を使います。
3. 本番 D1 にスキーマを適用し、初回のみ Direct Upload 用の Pages プロジェクトを作成します。別名を選んだ場合は設定の `name` と公開コマンドも合わせてください。

   ```powershell
   npx.cmd wrangler d1 migrations apply DB --remote
   npx.cmd wrangler pages project create ski-game --production-branch main
   ```

4. テストしたコミットから再ビルドし、Pages に配信します。Wrangler がルートの `functions/` と `dist/` をまとめます。

   ```powershell
   npm.cmd test
   npm.cmd run build
   npx.cmd wrangler pages deploy dist --project-name ski-game --branch main
   ```

無料プランでは、Functions と Workers 合計で1日10万リクエスト、D1 は1日500万行の読み取り・10万行の書き込みが目安です。ゲーム中の移動はすべて端末上で計算し、毎フレームの通信は行いません。静的アセットは Functions の対象外です。[Pages の料金](https://developers.cloudflare.com/pages/functions/pricing/)・[D1 の料金](https://developers.cloudflare.com/d1/platform/pricing/)

公開コマンドとマイグレーションの詳細は公式ガイドで確認できます。[Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)・[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
