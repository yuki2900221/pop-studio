# POP STUDIO 開発ルール

<!-- BEGIN YAMADAYA-AUTONOMOUS-DEV v0.1 -->
やまだや AI自律開発標準 v0.1。詳細は ~/.yamadaya-ai/standard-v0.1.md。
人間の目的・必須条件を守り、安全な範囲で調査・設計・実装・検証を自律実行する。
本番、実データ、秘密情報、費用、外部公開、認証・権限変更は対象の明示的許可が必要。
実施した検証と未実施項目を区別し、未許可操作だけを止める。
<!-- END YAMADAYA-AUTONOMOUS-DEV v0.1 -->

- 食料品小売店向け。WindowsのEdge・Chromeが主対象。
- 白基調のLiquid Glass風UI。操作に不要な宣伝コピーを追加しない。
- バックエンドはCloudflare、AIはWorkers AI。認証を追加する場合はGoogleのみ。
- 印刷・編集・PNGは共有SVGの配置を維持する。別の印刷用デザインを作らない。
- 保存JSON・AI応答を必ず実行時検証する。商品情報の推測や架空の成功応答をしない。
- 下書きは端末内保存。共有・サーバー保存を追加するときはデータ境界を設計する。
- `npm run check`・`npm run build`・`npm run format:check`を実行し、変更機能を実ブラウザでも確認する。
- `.env`、`.dev.vars`、認証情報、端末の個人ファイルをGitへ追加しない。
- 現在の仕様・選定理由はREADME.mdとdocs/architecture.md、検証証跡はdocs/testing.mdを参照する。
