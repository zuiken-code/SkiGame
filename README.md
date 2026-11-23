# Powder Chase

スマホのブラウザーで遊べる、滑走距離を競う3Dスキークロスゲームです。岩や木の手前でターンすると、後ろから自分を追ってきたスキーヤーを障害物に誘導できます。自分が障害物に当たると減速し、追手に触れるとその距離で滑走終了です。

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
4. 「滑走スタート」で開始し、終了画面で名前を入力して「登録」を押します。別のスマホでも同じ PC の URL を開くと、同じランキングに記録できます。

起動したターミナルでは `Ctrl+C` で停止できます。再起動後もローカル D1 の記録は `.wrangler/state/` に残ります。PC では開けてスマホで開けない場合は、Wi-Fi の端末間通信、Windows ファイアウォールのプライベートネットワークでの許可、Wi-Fi 側の IPv4 を選んでいるかを確認してください。

### 操作

| 操作 | スマホ | キーボード |
| --- | --- | --- |
| ターン | コースの好きな位置を押し、そこから左右へドラッグ | ← / → または A / D |
| 減速 | 押した位置から手前にドラッグ。指を離すと解除 | ↓ または S |
| 一時停止・再開 | 右上の一時停止ボタン、再開ボタン | Esc または P |

ページが非表示になると一時停止します。滑走の途中でベースキャンプに戻った場合は記録対象外です。WebGL 2 対応のブラウザーを使ってください。

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
- ベースキャンプの自己ベスト、滑走回数、振り切った追手の累計は端末にも保存します。開始時にサーバーと接続できなかった滑走も、端末の記録に残ります。端末変更やブラウザーデータの削除後は新しいプレーヤーになります。

## 構成とファイルの役割

描画・入力・物理演算・スコア保存を別々に追える構成です。描画と衝突判定は同じコース座標を参照します。

| パス | 役割 |
| --- | --- |
| `index.html`、`src/main.tsx` | ページの入口、React の起動、ローカル配信フォントと共通 CSS の読み込み |
| `src/App.tsx` | ロビー・ランキング・ゲームの切り替え、滑走単位のセッション、結果の登録 |
| `src/components/Navigation/Header.tsx` | ナビゲーション、名前設定、効果音切り替え |
| `src/components/Lobby/Lobby.tsx` | スタート画面、自己記録、上位3人の表示 |
| `src/components/Ranking/Ranking.tsx` | スコア一覧、同順位の表示、自分の順位、取得失敗時の再読み込み |
| `src/components/Dialogs/Dialogs.tsx` | 操作ガイド、プレーヤー名の設定、結果・再挑戦ダイアログ |
| `src/components/Game/GameScreen.tsx` | ゲームのフレーム更新、HUD、一時停止、終了判定の通知 |
| `src/components/Game/SteeringSurface.tsx` | 指を置いた位置に現れるスティック、ポインターキャプチャ、キーボード入力 |
| `src/components/Game/useGameSound.ts`、`game.css` | Web Audio の効果音とプレイ画面のレイアウト |
| `src/game/course.ts` | コース中心線、シード付き障害物配置、各列の通過可能なレーンの確保 |
| `src/game/simulation.ts` | 60Hz 固定ステップの滑走、減速、追手の出現・追跡・衝突、距離計測 |
| `src/game/simulation.test.mjs` | フレームレート差、衝突、追手の誘導、捕獲後の距離固定を検証 |
| `tests/leaderboard.test.mjs` | 実際のマイグレーションと API ハンドラーを SQLite で動かし、同順位・圏外順位・再送と自己ベスト保持を検証 |
| `src/scene/SkiScene.tsx` | React Three Fiber の Canvas、描画の開始・停止と WebGL のエラー処理 |
| `src/scene/environment/world.ts` | カメラと背景、地形、障害物、選手の座標を毎フレーム同期 |
| `src/scene/environment/piste.ts`、`tracks.ts` | カーブに沿う雪面メッシュと滑走跡 |
| `src/scene/environment/instances.ts` | 樹木・柵・追手など繰り返す物体のインスタンス描画 |
| `src/scene/models/geometry.ts`、`skier.ts`、`courseObjects.ts` | 共通の形状部品、選手、岩・木・山・コース設備の3Dモデルを生成 |
| `src/services/profile.ts` | ローカル統計、表示名、サウンド設定の保存と読み込み |
| `src/services/leaderboard.ts` | 匿名トークンの生成・保持、API 呼び出し、タイムアウト、応答の型確認 |
| `src/styles/base.css`、`lobby.css` | 配色・共通 UI、スマホ／デスクトップのロビーとランキングのレイアウト |
| `functions/api/[[endpoint]].ts` | Pages Functions の HTTP ルート、リクエスト検証、D1 アクセス |
| `migrations/0001_leaderboard.sql` | 滑走と自己ベストのテーブル、順位用インデックス、自己ベスト更新のトリガー |
| `public/powder-chase.jpg`、`ridge.svg`、`contours.svg` | タイトルのキービジュアル、ファビコン、記録カードの等高線 |
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

**調整箇所**　スピード、減速からの復帰、追手の横移動と追加間隔は `simulation.ts`、障害物の密度とカーブは `course.ts`、ジョイスティックの可動半径は `SteeringSurface.tsx` です。実機では「岩の手前でどれだけ引きつけられるか」「画面下に追手が見えるか」「指を離した直後に自然に戻るか」を続けて試すと調整しやすくなります。

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

<details>
<summary>タイトル画像の制作情報</summary>

`public/powder-chase.jpg` は内蔵 ImageGen で生成したイラストです。プレイ中に表示するキャラクターやコースは `src/scene/` の3Dモデルから描画します。

生成プロンプト

> Use case: stylized-concept. Asset type: ultra-wide key art for an alpine arcade ski racing game. Landscape 2.5:1 composition. Highly art-directed adventurous vintage alpine travel poster, rendered as bold angular polygonal cut-paper shapes with tactile halftone speckle, woodcut facets and powder spray. In strong oblique action view a single large athletic downhill skier in vivid tangerine vermilion jacket, dark navy blue trousers, charcoal helmet with glossy amber goggles and two thin dark ski poles leans into a deep racing carve through powder toward bottom left. Place main skier at x=73%, body centered y=47%, visible two parallel red racing skis at y=78%, fully illustrated with memorable readable silhouette. Swirling luminous pale cyan powder explodes around their boots. Behind: serrated pale icy sunlit mountain peaks, cool teal sky, diagonal snow slope with dark spruce clusters, one tiny far-distant skiing silhouette. Mood crisp high-altitude morning. Left 30 percent of image is quiet dark deep blue shadowed alpine spruce forest and slopes; right 70 percent icy turquoise, white snow, strong orange pop, dramatic sunlit atmosphere. Intentional atmospheric depth, art for a premium indie snow sports game, dynamic, distinct planes of light and blue shadow. Edge-to-edge art. No text, no lettering, no logos, no UI, no frames.

</details>
