# APIドキュメント

securePDF の HTTP API は、Web UI と同じ操作スキーマを使う自動処理向けインターフェースです。

軽量な検証や仕様取得は Cloudflare Worker が処理し、PDF 生成や Office 変換など重い処理は変換バックエンドへストリーム転送します。

## Base URL

Web UI と同じオリジンを使います。

```text
https://securepdf.takumi-tokunaga.com
```

## 認証

バックエンド変換が必要なエンドポイントでは、API キーを `X-API-Key` ヘッダーで送信します。

```http
X-API-Key: $SECUREPDF_API_KEY
Accept: application/json
```

API キーは `tkp_` で始まる文字列です。Web UI では、ヘッダー右端の「その他」メニューから「認証」を開いて設定できます。

## エンドポイント

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/v1/capabilities` | 利用可能なローカル処理・リモート処理を取得 |
| `GET` | `/openapi.json` | OpenAPI 3.1 仕様を取得 |
| `POST` | `/api/v1/validate-plan` | plan の構造を検証 |
| `POST` | `/api/v1/organize` | PDF 整理処理を実行 |
| `POST` | `/api/v1/convert/to-pdf` | 画像などを PDF へ変換 |
| `POST` | `/api/v1/convert/office` | Office ファイルを PDF へ変換 |

## capabilities

```bash
curl https://securepdf.takumi-tokunaga.com/api/v1/capabilities
```

レスポンス例:

```json
{
  "version": "1",
  "local": {
    "operations": ["merge", "split", "extract", "delete", "rotate", "flip", "reorder", "insertPdf", "insertImage", "convertToPdf"],
    "inputFormats": ["application/pdf", "image/jpeg", "image/png"]
  },
  "remote": {
    "available": true,
    "via": "cloud-run",
    "adds": ["office-to-pdf"],
    "maxInputBytes": 104857600
  }
}
```

## validate-plan

`validate-plan` は plan の構造を検証します。ファイル本体は解析しないため、ページ数など実ファイルに依存する検証はブラウザまたは変換バックエンド側で行います。

```bash
curl -X POST https://securepdf.takumi-tokunaga.com/api/v1/validate-plan \
  -H 'content-type: application/json' \
  -d '{"version":"1","operations":[],"output":{"format":"pdf"}}'
```

## organize / convert

ファイルを伴う実行系エンドポイントは `multipart/form-data` を使います。

- `plan`: JSON の操作 plan。
- `a`, `b` など: plan から参照される入力ファイル。

```bash
curl -X POST https://securepdf.takumi-tokunaga.com/api/v1/organize \
  -H "X-API-Key: $SECUREPDF_API_KEY" \
  -F 'plan={"version":"1","operations":[{"op":"merge","inputs":["a","b"]}],"output":{"format":"pdf"}};type=application/json' \
  -F 'a=@a.pdf;type=application/pdf' \
  -F 'b=@b.pdf;type=application/pdf' \
  -o output.pdf
```

## エラー

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

代表的なコード:

- `INVALID_PLAN`: plan の構造が不正。
- `UNAUTHORIZED`: API キーが未指定または無効。
- `RATE_LIMITED`: レート制限またはクレジット制限。
- `BACKEND_NOT_CONFIGURED`: 変換バックエンドが未設定。
- `BACKEND_UNAVAILABLE`: 変換バックエンドへ到達できない。

## OpenAPI

機械可読の仕様は [`/openapi.json`](/openapi.json) から取得できます。
