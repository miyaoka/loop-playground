# loop-scroll 使い方

マーキー風の無限ループスクロールを実現するWeb Component。

## 基本的な使い方

```html
<script src="loop-scroll.js"></script>

<loop-scroll>
  <div class="item">Item 1</div>
  <div class="item">Item 2</div>
  <div class="item">Item 3</div>
</loop-scroll>
```

## 属性一覧

| 属性 | 型 | デフォルト | 説明 |
|------|-----|------------|------|
| `speed` | number | 100 | スクロール速度（px/秒）。マイナスで逆方向、0で停止 |
| `fill` | boolean | false | コンテナを埋めるまでアイテムを繰り返す |
| `hover-pause` | boolean | false | ホバー時にアニメーションを一時停止 |

## 使用例

### 速度の指定

```html
<!-- 200px/秒 -->
<loop-scroll speed="200">...</loop-scroll>

<!-- 逆方向に50px/秒 -->
<loop-scroll speed="-50">...</loop-scroll>

<!-- 停止 -->
<loop-scroll speed="0">...</loop-scroll>
```

### 充填モード

コンテンツがコンテナより小さい場合、自動的に繰り返して埋める。

```html
<loop-scroll fill>
  <div class="item">Only One</div>
</loop-scroll>
```

### ホバーで一時停止

```html
<loop-scroll hover-pause>
  <div class="item">Item 1</div>
  <div class="item">Item 2</div>
</loop-scroll>
```

### %指定の子要素

子要素に%で幅を指定可能。コンテナ幅を基準に計算される。

```html
<loop-scroll style="width: 800px;">
  <div style="width: 50%;">50%</div>
  <div style="width: 25%;">25%</div>
  <div style="width: 25%;">25%</div>
</loop-scroll>
```

### 動的コンテンツ

子要素の内容が動的に変更されても、自動的にレイアウトが更新される。

```html
<loop-scroll>
  <div class="item" id="dynamic">Loading...</div>
</loop-scroll>

<script>
  setTimeout(() => {
    document.getElementById("dynamic").textContent = "Updated content";
  }, 3000);
</script>
```

## CSSスタイリング

### コンテナの幅指定

```css
loop-scroll {
  width: 100%;      /* 親要素いっぱい */
  width: 500px;     /* 固定幅 */
  width: fit-content; /* コンテンツに合わせる */
}
```

### 必須スタイル

コンポーネントが正しく動作するために必要なスタイル:

```css
loop-scroll {
  display: flex;
  overflow: hidden;
  position: relative;
}
```

### デバッグ用スタイル（オプション）

fill/cloneを視覚的に確認する:

```css
/* fillクローン */
[data-fill-clone] {
  filter: grayscale(100%);
}

/* loopクローン */
.loop-clone .item {
  opacity: 0.5;
}
```

## クリックイベント

クローンされた要素のクリックイベントは、オリジナル要素に委譲される。

```html
<loop-scroll fill>
  <button onclick="alert('clicked')">Click me</button>
</loop-scroll>
```

`onclick`属性はそのまま動作する。`addEventListener`で追加したイベントもオリジナルに委譲される。

## アクセシビリティ

### prefers-reduced-motion 対応

OSの「動きを減らす」設定が有効な場合、自動的にアニメーションが一時停止する。
設定が変更されるとリアルタイムに反映される。

追加の設定は不要。
