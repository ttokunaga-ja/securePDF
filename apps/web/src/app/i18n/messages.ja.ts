// The Japanese UI message catalog — the single source of truth for user-facing
// strings. Keys are dot-namespaced by area. `{name}` tokens are interpolated by
// `t()`. Adding a second locale means adding a sibling catalog with the same keys.

export const ja = {
  'app.heading': 'securePDF — PDF 編集',
  'app.skipToMain': '本文へスキップ',
  'app.fileInput': 'PDF・画像ファイルを選択',
  'app.crashed.title': '問題が発生しました',
  'app.crashed.body': '画面の描画中にエラーが発生しました。ページを再読み込みしてください。',
  'app.crashed.reload': '再読み込み',

  'toolbar.deleteSelected': '選択ページを削除',
  'toolbar.rotateSelectedLeft': '選択ページを左に回転',
  'toolbar.flipSelected': '選択ページを反転',
  'toolbar.rotateSelectedRight': '選択ページを右に回転',
  'toolbar.selectAll': '全選択',
  'toolbar.clearSelection': '選択解除',
  'toolbar.filenameLabel': 'ダウンロードファイル名',
  'toolbar.zoomOut': '縮小',
  'toolbar.zoomIn': '拡大',
  'toolbar.zoomLabel': '拡大率',
  'toolbar.print': '印刷',
  'toolbar.download': 'PDFをダウンロード',
  'toolbar.more': 'その他',
  'toolbar.moreMenuLabel': 'その他の操作',
  'toolbar.singlePageView': '1ページ表示',
  'toolbar.twoPageView': '2ページ表示',
  'toolbar.pageLabel': 'ページ番号',
  'toolbar.resizePane': 'サムネイル列の幅',

  'rail.label': 'ページ一覧',
  'rail.dragBadge': '{count}枚',

  'preview.label': 'ページプレビュー',

  'empty.title': 'PDF を開いて編集',
  'empty.body':
    'PDF・画像ファイルをここにドロップ、またはクリックして開きます。すべてブラウザ内で処理され、アップロードされません。',
  'empty.open': 'ファイルを開く',

  'status.pagesAdded': '{count}ページを追加しました。合計{total}ページ。',
  'status.pagesRemoved': '{count}ページを削除しました。残り{total}ページ。',
  'status.reordered': 'ページを移動しました。',

  'card.delete': '削除',
  'card.select': '選択',
  'card.deselect': '選択解除',
  'card.rotateLeft': '左に回転',
  'card.flip': '反転',
  'card.rotateRight': '右に回転',
  'card.moveUp': '前のページと入れ替え',
  'card.moveDown': '次のページと入れ替え',
  'card.openPage': '{position}/{total}ページを表示',

  'insert.label': '{position}番目の位置に挿入',

  'export.failed': 'PDFの生成に失敗しました',

  'import.officeUnavailable':
    'Office ファイルの変換は現在利用できません（変換サーバが未設定です）。',
  'import.officeFailed': '「{name}」を PDF に変換できませんでした。',
  'import.officeAuthRequired': 'Office 変換にはサインインが必要です。',
  'import.officeAuthPopupBlocked':
    'Google サインインのポップアップを開けませんでした。もう一度ファイルを選択してください。',
  'import.officeNoCredits': '本日の変換クレジットを使い切りました。',
} as const
