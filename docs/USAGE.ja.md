[简体中文](./USAGE.zh-CN.md) · [English](./USAGE.en.md)

# EasyAR CRS プラグイン クイックスタート

このガイドは、Cursor で **easyar-crs** エージェントプラグイン（v0.1.0）を使うためのものです。EasyAR クラウド認識（CRS）の画像ライブラリを管理し、手元の画像をそのライブラリと照合します。以下の事実は、このリポジトリの `README.md`、`plugin.json`、`mcp.json`、`server/index.mjs`、`skills/easyar-crs/SKILL.md` に基づきます。インストール手順は、文中でリンクしている Cursor のプラグインドキュメントに従います。

## 1. できること

プラグインは、npm 依存のない stdio MCP サーバーと、`easyar-crs` というスキルで構成されます。Cursor のエージェントには普通の言葉で依頼します。スキルの説明では、EasyAR CRS、云识别、识别图/目标图 に触れたとき、または AR のターゲット画像をアップロード、確認、検索したいときに使う、とあります。認証はトークン方式だけです。API Secret はトークン要求の署名にだけ使い、トークンは期限の 60 秒前までキャッシュされ、その後の呼び出しにはそのトークンが付きます。ツールは 8 つです。

| ツール | 依頼できること |
|---|---|
| `crs_list_targets` | ライブラリ内の画像ターゲットを一覧します。ページ番号の既定は 1。ページサイズの既定は 5 で、最大は 100 です。 |
| `crs_get_target` | ターゲット ID で 1 件を表示します。トラッキング画像は、依頼しない限り省略されます。 |
| `crs_grade_image` | ターゲットを作る前に、手元の画像を採点します。既定の種類は `detection`（検出）で、−1 は無効、0–1 は容易、2 は普通、3–4 は困難です。検出の点数が 3 以上のとき、スキルは注意を促します。他の種類は `tracking`（トラッキング）と `detail`（詳細）です。 |
| `crs_find_similar` | 似たターゲットがライブラリに既にあるかを調べます。結果が空なら、該当なしです。 |
| `crs_create_target` | 画像ターゲットを作成します。先に採点と類似チェックを行います。似たものがある場合、明示的に受け入れたあとでのみ、エージェントは `allowSimilar` を `1` にします。作成は 1 回だけで、自動では再試行しません。 |
| `crs_update_target` | 名前を挙げた項目だけを変更します。実際の呼び出しではパッチの動作でした。`name` と `meta` だけを送ると、`size`、`active`、画像はそのままです。`active` を `0` にすると、ターゲットは残したまま認識を止めます。 |
| `crs_delete_target` | ターゲットを 1 件、完全に削除します。確認が渡されるまでツールは拒否します（`confirm: true` が必要です）。 |
| `crs_search_image` | クライアント URL で、手元の画像をライブラリと照合します（`POST` `/v2/search`）。トラッキング画像が不要なら、その旨を伝えます（`notracking` は `true`）。 |

手元の画像は、JPG または PNG の絶対パスで、サイズは 2 MB 以下です。新規ターゲットには、名前（1〜64 文字。英字、英文の句読点、数字）と、センチメートル単位の幅（文字列。例: `20`）も必要です。`meta` は任意で、最大 2 MB です。

一覧、取得、採点、類似チェック、作成、更新、削除はサーバー URL を使います。照合はクライアント URL を使います。

## 2. 事前準備

- **Node.js 18 以上**が `node` として `PATH` にあること。サーバーに追加パッケージはありません。`README.md` の条件は Node ≥ 18 です。
- **Cursor** にこのプラグインを読み込んであること（第 3 節）。
- **EasyAR の開発者アカウント**で、EasyAR Developer Center にサインインできること。

次の値はそのアカウントからコピーします。`README.md` が既に引用している EasyAR の 2 ページが参照先です。

- API Key と API Secret: [Get and use API Key](https://easyar.com/doc/en/develop/apikey-auth.html)。Developer Center にサインインし、**Authorization** の **Cloud Service API KEY** で **Create API KEY** を選び、**cloud recognition** を選択します。ページに API Key と API Secret が表示されます。EasyAR は、両方を非公開にし、Web ページやミニプログラムなどのクライアントアプリに置かないよう注意しています。
- CRS AppId: 同じページでは、クラウド認識ライブラリの AppId であり、Developer Center の該当サービスで確認する、と説明されています。API Key には、そのライブラリの利用が許可されている必要があります。
- サーバー URL とクライアント URL: [Introduction to cloud recognition APIs](https://www.easyar.com/doc/en/api/cloud/cloud-recognition/apis.html) は、README からリンクされている API の概要です。この 2 つのアドレスは、自分の CRS ライブラリのものです。Developer Center のライブラリから、サーバー側 URL（ターゲット管理、採点、類似チェック）とクライアント側 URL（照合）をコピーします。このリポジトリは、その画面のメニュー名までは書いていません。クライアント URL のポートは残します。照合はその URL に `/v2/search` を付けて呼び、成功した照合ではポート **8443** を使っていました。

## 3. インストール

### Cursor Marketplace に掲載されたあと

[Cursor のプラグインドキュメント](https://cursor.com/docs/plugins)では、Agent Plugin（プラグインのルートに `plugin.json` がある形式。このリポジトリがそれです）も Cursor Plugin も、同じ手順でインストールします。

1. サイドバーで **Customize** を開く。
2. **EasyAR CRS** を検索する（プラグイン id は `easyar-crs`）。
3. **Install** を選び、プロジェクト範囲かユーザー範囲かを選ぶ。

[cursor.com/marketplace](https://cursor.com/marketplace) から探すこともできます。Marketplace のプラグインは掲載前にレビューされます。このプラグインは、まだ掲載されていない場合があります。

### それまでの間、この GitHub リポジトリから使う

Cursor の公開ドキュメントにあるのは、Marketplace からのインストールと、未公開プラグイン用のローカルフォルダです。marketplace マニフェストのない単一の Agent Plugin に対して、「GitHub の URL を貼れば入る」という別手順は書かれていません。より新しい Cursor に GitHub からのインストール画面が付いた場合は、その画面を使ってください。以下は、現在のドキュメントにある手順です。

このリポジトリは、ルートに 1 つのプラグインがあります（`plugin.json`、`mcp.json`、`skills/easyar-crs/SKILL.md`、`server/index.mjs`）。[ローカルでプラグインを試す](https://cursor.com/docs/plugins)手順は次のとおりです。

1. リポジトリを `~/.cursor/plugins/local/easyar-crs` にコピーし、`plugin.json` がそのフォルダの直下に来るようにします（Windows では、ユーザープロファイル配下の `.cursor/plugins/local/easyar-crs`）。`~/.cursor/plugins/local` の外を指すシンボリックリンクはスキップされます。ファイルをコピーするか、その場所に実ディレクトリとしてクローンします。
2. Cursor を再起動するか、**Developer: Reload Window** を実行します。
3. **Customize** を開き、`easyar-crs` のスキルと MCP サーバーが表示されることを確認します。ローカルプラグインの取り込みが許可されているとき、Cursor はこのフォルダを見つけます。
4. Enterprise では **Allow Local Plugin Imports** が既定でオフです（Dashboard → Settings → Security & Identity → Marketplace and Plugins）。同じスイッチが、Customize の **Import from Disk** も制御します。同じ名前の Marketplace プラグインが既に入っている場合、読み込まれるのは Marketplace 側です。

チーム Marketplace の **Import from Repo** と、Customize の **From GitHub Repository** は、`.cursor-plugin/marketplace.json` を含むリポジトリ向けに説明されています。このリポジトリにそのファイルはありません。

`mcp.json` は、作業ディレクトリ `${PLUGIN_ROOT}` で `node server/index.mjs` を起動します。[Cursor のプラグインリファレンス](https://cursor.com/docs/reference/plugins)では、Agent Plugin の `mcp.json` は `command`、`args`、`env`、`cwd` で `${CURSOR_PLUGIN_ROOT}` を展開し、`${PLUGIN_ROOT}` は展開しない、とあります。`node` が `server/index.mjs` を見つけられない場合、理由はその差です。この変数を直すのはプラグイン側の変更であり、ここまでの手順とは別です。

## 4. 変数を設定する

`mcp.json` は、下の名前をサーバープロセスへ渡します。サーバーが読むのはプロセスの環境変数です。値が文字どおりの `${NAME}` のままなら、未設定として扱います。足りない名前があると、`Missing EasyAR CRS configuration: …` とその名前が返ります。

**値は自分のマシンにだけ置きます。決してコミットしないでください。** API Key と API Secret をチャットに貼り付けないでください。スキルは、エージェントがチャットで Secret を尋ねないように指示しています。`.gitignore` は `.env*` を無視しますが、サーバーは `.env` ファイルを読みません。変数を渡すのは `mcp.json` です。

Cursor のドキュメントでは、プラグイン変数の入力先は **Plugins → Configure**（ダッシュボード。インストール時、またはその後）です。これは、マニフェストの直下に `variables` スキーマを宣言する Cursor Plugin の説明です。このパッケージは Agent Plugin です。Agent Plugins 1.0.0 には直下の `variables` フィールドがないため、`plugin.json` では `extensions["com.easyar.crs"].variables` に名前を宣言しています。**Configure** にこの 6 項目が出る場合は、そこに入力します。出ない場合、このリポジトリは別の Cursor 画面を記載していません。

| 変数 | 必須 | 秘密 | 役割 |
|---|---|---|---|
| `EASYAR_API_KEY` | はい | はい | API Key。トークン要求で送ります。 |
| `EASYAR_API_SECRET` | はい | はい | API Secret。トークン要求の署名にだけ使います。 |
| `EASYAR_CRS_APP_ID` | はい | いいえ | CRS ライブラリの AppId。毎回の呼び出しに含め、トークンのアクセス範囲にも入れます。 |
| `EASYAR_CRS_SERVER_URL` | 一覧、取得、採点、類似、作成、更新、削除では必須 | いいえ | サーバー側 URL。`plugin.json` では必須です。 |
| `EASYAR_CRS_CLIENT_URL` | 照合では必須 | いいえ | クライアント側 URL。照合は末尾に `/v2/search` を付けます。`plugin.json` では必須です。ライブラリがポート 8443 付きで公開している場合は、そのポートも入れます。 |
| `EASYAR_REGION` | いいえ | いいえ | `cn1`（既定）または `na1`。トークンサービスを選びます。正確に `na1` のときだけ北米のサービスを選びます。誤記や空を含むそれ以外の値は、既定（`cn1`）のサービスを選びます。2 つのトークンホスト名は README の変数表にあります。 |

## 5. プロンプト例

パスとターゲット ID は、自分のものに置き換えてください。エージェントは `skills/easyar-crs/SKILL.md` に従います。Cursor では、プラグインのスキルを `/easyar-crs` でも呼び出せます。

1. **一覧** — 「EasyAR CRS ライブラリの画像ターゲットを一覧して。」
2. **1 件を見る** — 「CRS ターゲット `<targetId>` の詳細を見せて。トラッキング画像は不要。」
3. **採点** — 「ターゲットを作る前に、`/absolute/path/image.jpg` を検出用に採点して、認識が難しそうか教えて。」
4. **類似ターゲット** — 「`/absolute/path/image.jpg` が、ライブラリに既にあるターゲットと似ていないか確認して。」
5. **作成** — 「`/absolute/path/image.jpg` から、名前 `Poster_01`、幅 20 cm の CRS 画像ターゲットを作って。先に採点し、似たターゲットがないかも見て。」
6. **更新** — 「CRS ターゲット `<targetId>` の名前を `Poster_02` に変えて。画像、サイズ、active はそのまま。」
7. **削除** — 「CRS ターゲット `<targetId>` を削除して。」エージェントは、先に確認を取ります。確認を `confirm: true` として渡すまで、ツールは `Refusing to delete: pass confirm:true after the user confirms.` を返します。「削除」と一度言うだけでは足りません。まだ使う可能性があるなら、削除ではなく認識を止めるよう頼んでください（`active` は `0`）。
8. **照合** — 「`/absolute/path/photo.jpg` を CRS ライブラリと照合して。一致したターゲット ID だけ分かればよく、トラッキング画像は不要。」

## 6. 困ったとき

**変数が未設定。** 返答は `Missing EasyAR CRS configuration:` で始まり、名前が並びます。自分のマシンでその値を入れてください。API Secret はチャットに出さないでください。

**トークンのエラー。** トークン要求の失敗は `Token request failed (HTTP …)` の形で、続けて JSON 本文が付きます（500 文字で切れます）。API Key、API Secret、`EASYAR_REGION`、そしてこのキーが当該ライブラリの AppId でクラウド認識を許可されているかを確認します。[API Key のページ](https://easyar.com/doc/en/develop/apikey-auth.html)のエラー表には、`4001011`（API Key が無効）、`4001012`（タイムスタンプが無効。単位はミリ秒で、標準時刻との差は 5 分以内）、`4001015`（署名が無効。Secret が Key と一致しない）、`4001017`（この API Key はその AppId を許可していない）、`4001024`（トークンの期限切れ）があります。サーバーは、成功したトークンを期限の 60 秒前までキャッシュし、その後あらためて要求します。

**リージョンの違い。** `EASYAR_REGION` を、ライブラリに合わせて `cn1` または `na1` にします。既定は `cn1` です。北米のトークンサービスを選ぶのは `na1` だけです。

**ネットワーク。** 接続リセット、タイムアウト、接続拒否、ソケットエラー（`UND_ERR_SOCKET`）については、トークン要求と、一覧、取得、採点、類似、更新、削除、照合で、最大 3 回再試行します。再試行の前の待ち時間は、3 秒に試行回数を掛けた長さです。作成はこの再試行に含まれません。ネットワークで作成が失敗したら、もう一度作る前に一覧を取り、実際には保存済みのターゲットを二重に追加しないようにします。中国リージョンのライブラリは、中国本土以外の一部のネットワークから届かないことがあります。照合はクライアント URL のポート **8443** を使います。成功が確認された照合は中国本土のネットワークからで、それより前の実行では別のネットワークで TLS の接続リセットが起きています。届くかどうかは、この MCP サーバーが動いているマシンのネットワークによります。

**ターゲットが見つからない。** 削除済みの ID に対する `crs_get_target` は、HTTP 200 で、`statusCode` が 404、`result` が `"Target not found"` になります。サーバーはこの呼び出しをエラーとして扱います。`statusCode` が 0 以外はエラーになるためです。`statusCode` と `msg` は、API が返したまま読んでください。

**画像または更新が拒否される。** ファイルは JPG か PNG、2 MB 以下、絶対パスである必要があります（`Only JPG and PNG images are supported`、または 2 MB 制限のメッセージ）。項目を一つも渡さない更新は、`Nothing to update: provide at least one field` を返します。

## 7. EasyAR のドキュメント

このリポジトリの README に列挙されているリンクと同じです。

- 概要と認証: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/apis.html
- API Key とトークン: https://easyar.com/doc/en/develop/apikey-auth.html
- 作成: https://www.easyar.cn/doc/zh-cn/api/cloud/cloud-recognition/target-create.html
- 一覧: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-list.html
- 取得: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-get.html
- 更新: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-update.html
- 削除: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-delete.html
- 類似: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-similar.html
- 採点: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-grade.html
- 照合: https://easyar.com/doc/en/api/cloud/cloud-recognition/target-search.html
