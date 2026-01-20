# loop-scroll 内部設計

## DOM構造

```
<loop-scroll>                    ← コンテナ (position: relative)
  <div class="loop-sizer">       ← サイズ決定用 (visibility: hidden)
    [baseItemsのクローン]
  </div>
  <div class="loop-track">       ← アニメーション対象 (position: absolute)
    [baseItems]
    [fillクローン]               ← data-fill-clone属性
    <div class="loop-clone">     ← ループ用クローン (position: absolute)
      [全アイテムのクローン]
    </div>
  </div>
</loop-scroll>
```

## sizerとtrackの分離

### 問題
- `fit-content`に切り替えたとき、trackにfillクローンがあるとコンテナが縮小しない
- ResizeObserverが発火せず、レイアウト更新が行われない

### 解決策
- `_sizer`: コンテナのサイズを決定する要素（baseItemsのクローンのみ）
- `_track`: 実際のアニメーション要素（`position: absolute`でコンテナサイズに影響しない）

これにより、fillクローンの有無に関わらずコンテナサイズが正しく計算される。

## アニメーション

### Web Animations API

CSSアニメーションではなくWeb Animations APIを使用。

理由:
- `translateX(-100%)`は要素自身の幅の100%
- trackWidthを動的に変える必要があるため、固定ピクセル値で指定したい
- `translateX(-${trackWidth}px)`で正確な移動距離を指定

### playbackRateによる速度制御

```javascript
// 基準: 1px/秒で移動するduration
const baseDuration = trackWidth * 1000; // ms

animation.playbackRate = speed;
// speed=100  → 100px/秒
// speed=-50  → 逆方向に50px/秒
// speed=0    → 停止
```

利点:
- マイナス値で自然に逆再生（`direction`プロパティ不要）
- 0で自然に停止（特別処理不要）
- 動的なspeed変更が容易

### 進行率の保持

リサイズ時にアニメーションを再作成しても、スクロール位置を維持:

```javascript
// 保存
const progress = (currentTime / oldDuration) % 1;
// 復元
animation.currentTime = progress * newDuration;
```

## Observer

### ResizeObserver

監視対象:
- `this`（コンテナ）
- `_baseItems`（各子要素）

発火時に`_updateLayout()`を呼び出す。

### MutationObserver

監視対象:
- `_baseItems`の各要素

オプション:
- `childList: true`
- `subtree: true`
- `characterData: true`

動的コンテンツの変更を検知してレイアウト更新。

## レイアウト更新フロー

```
_updateLayout()
  ↓
  trackの幅をリセット (width: "")
  ↓
_measureAndAnimate()
  ↓
  sizerのクローンを更新
  ↓
  baseItemsの幅を計算
  ↓
  fillクローンを削除→再作成
  ↓
  trackWidth = max(containerWidth, trackContentWidth)
  ↓
  loopクローンを作成
  ↓
  アニメーション設定
```

## %指定の対応

### 問題
`width: max-content`だと、子要素の`width: 50%`が正しく計算されない。

### 解決策
`_sizer`と`_track`に`minWidth: 100%`を設定:

```javascript
Object.assign(this._track.style, {
  minWidth: "100%", // 子の%指定がコンテナ幅基準になる
});
```

### loopクローンの幅

`_cloneContainer`は`position: absolute`なので、%指定が効かない。
クローン作成時に元要素の実際の幅（px）を設定:

```javascript
clone.style.width = `${item.offsetWidth}px`;
```

## クリックイベントの委譲

`cloneNode(true)`の挙動:
- `onclick`属性 → コピーされる（そのまま動作）
- `addEventListener` → コピーされない

`onclick`属性がない場合、クローンにクリックイベントを追加し、オリジナルの`click()`を呼び出す:

```javascript
clone.addEventListener("click", (e) => {
  e.stopPropagation();
  this._baseItems[index % this._baseItems.length]?.click();
});
```

## IDの重複防止

`_sizer`やクローンにはIDがコピーされるため、重複を防ぐ:

```javascript
clone.removeAttribute("id");
clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
```

## クリーンアップ

`disconnectedCallback`で以下をクリーンアップ:
- ResizeObserver
- MutationObserver
- Animation
- requestAnimationFrame ID
