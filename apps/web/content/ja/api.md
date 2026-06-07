# APIドキュメント

securePDF API は、PDF 整理やファイル変換をプログラムから実行したい利用者向けの API です。

画面上で PDF を編集するだけなら API は不要です。外部ツールや自分のスクリプトから securePDF の変換機能を呼び出したい場合に利用してください。

## はじめに

Base URL:

```text
https://securepdf.takumi-tokunaga.com
```

機械可読の仕様は [`/openapi.json`](/openapi.json) から取得できます。

## API キー

認証が必要な処理では、API キーを `X-API-Key` ヘッダーで送信します。

```http
X-API-Key: $SECUREPDF_API_KEY
Accept: application/json
```

API キーは `tkp_` で始まる文字列です。Web 画面では、右上の「その他」メニューから「認証」を開いて設定できます。

Office ファイルの PDF 変換は 1 回あたり 5 クレジットを消費します。API キーが無効な場合やクレジットが不足している場合、API はエラーを返します。

## エンドポイント

| Method | Path | 用途 | 認証 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/capabilities` | 利用できる処理を確認 | 不要 |
| `GET` | `/openapi.json` | OpenAPI 仕様を取得 | 不要 |
| `POST` | `/api/v1/validate-plan` | PDF 操作 plan の形式を検証 | 不要 |
| `POST` | `/api/v1/organize` | PDF 整理処理を実行 | 処理内容により必要 |
| `POST` | `/api/v1/convert/to-pdf` | 画像などを PDF へ変換 | 処理内容により必要 |
| `POST` | `/api/v1/convert/office` | Office ファイルを PDF へ変換 | 必要 |

## 利用できる処理を確認する

```bash
curl https://securepdf.takumi-tokunaga.com/api/v1/capabilities
```

レスポンスには、現在の環境で使える入力形式や変換機能が含まれます。Office 変換が利用できない場合は、画面や API でその旨のエラーを返します。

## plan を検証する

API では、どのページをどう扱うかを JSON の `plan` で指定します。`validate-plan` はファイルを送らずに、その `plan` の形式だけを確認するためのエンドポイントです。

```bash
curl -X POST https://securepdf.takumi-tokunaga.com/api/v1/validate-plan \
  -H 'content-type: application/json' \
  -d '{"version":"1","operations":[],"output":{"format":"pdf"}}'
```

## PDF を整理する

ファイルを伴う処理は `multipart/form-data` で送信します。

- `plan`: 実行したい操作を表す JSON。
- `a`, `b` など: `plan` から参照する入力ファイル。

```bash
curl -X POST https://securepdf.takumi-tokunaga.com/api/v1/organize \
  -H "X-API-Key: $SECUREPDF_API_KEY" \
  -F 'plan={"version":"1","operations":[{"op":"merge","inputs":["a","b"]}],"output":{"format":"pdf"}};type=application/json' \
  -F 'a=@a.pdf;type=application/pdf' \
  -F 'b=@b.pdf;type=application/pdf' \
  -o output.pdf
```

## Office ファイルを PDF に変換する

Office 変換では API キーが必要です。

```bash
curl -X POST https://securepdf.takumi-tokunaga.com/api/v1/convert/office \
  -H "X-API-Key: $SECUREPDF_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"filename":"sample.docx","mimeType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","fileBase64":"..."}'
```

レスポンスには、変換後 PDF の base64 文字列が含まれます。Office 変換は 1 回あたり 5 クレジットを消費します。

## エラー時の確認

エラー時は `ok: false` と `error.code` を含む JSON を返します。

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid API key."
  }
}
```

代表的なエラー:

- `UNAUTHORIZED`: API キーが未指定、または無効です。認証メニューで API キーを確認してください。
- `RATE_LIMITED`: 利用回数またはクレジットの制限に達しています。
- `UNSUPPORTED_FORMAT`: 対応していないファイル形式です。
- `BACKEND_NOT_CONFIGURED`: その変換機能は現在利用できません。
- `BACKEND_UNAVAILABLE`: 変換処理へ一時的に到達できません。時間を置いて再試行してください。
