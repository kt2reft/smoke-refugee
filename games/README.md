# KT2REFT GAMES（作品一覧ページ）

公開中の自作ブラウザゲームをまとめた、ゲーム販売サイト風の作品公開ページです。

- 公開URL：https://kt2reft.github.io/smoke-refugee/games/
- 構成：`index.html` 1枚（CSS・JS インライン、外部読み込みなし）＋ `assets/` のスクリーンショット

## 作品を追加・変更する

`index.html` 内の `const GAMES = [ ... ]` を編集します。1作品ぶんの項目は次の通りです。

| キー | 内容 |
| --- | --- |
| `id` | 画像ファイル名と詳細ページの URL ハッシュ（`#smoke-refugee` など）に使います |
| `title` / `jp` | 英字タイトル／日本語の読み・副題 |
| `tagline` / `genre` | キャッチコピー／ジャンル表記 |
| `lead` / `desc` | 詳細の導入文／補足説明 |
| `url` | 「遊ぶ」のリンク先 |
| `accent` / `accent2` | その作品のテーマ色（ボタンやカードの縁に使われます） |
| `tags` / `cats` | 表示用タグ／絞り込み用（`solo` `multi` `online` `3d`） |
| `players` / `updated` | プレイ人数／更新日 |
| `isNew` / `alpha` | カード左上のバッジ表示 |
| `features` / `controls` / `note` | 特徴の箇条書き（`<b>` 可）／操作表／注意書き |

## 画像の差し替え

1作品につき 2 枚を `assets/` に置きます（名前は `id` と同じ）。

- `assets/<id>.webp` … 1280×720（ヒーローと詳細で使用）
- `assets/<id>-sm.webp` … 640×360（カードのサムネイル）

スクリーンショットから作る場合：

```
convert shot.png -resize 1280x720 -quality 78 assets/<id>.webp
convert shot.png -resize  640x360 -quality 72 assets/<id>-sm.webp
```

## 別リポジトリへ移す

この `games/` フォルダをそのまま移動すれば動きます。`kt2reft.github.io` リポジトリの直下に中身を置けば
https://kt2reft.github.io/ で公開できます（リンクはすべて絶対 URL なので、置き場所を変えても直す必要はありません）。
