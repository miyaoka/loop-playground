class LoopScroll extends HTMLElement {
  static get observedAttributes() {
    return ["speed", "fill"];
  }

  constructor() {
    super();
    this._baseItems = [];
    this._lastTrackWidth = 0;
    this._resizeObserver = null;
    this._mutationObserver = null;
    this._track = null;
    this._cloneContainer = null;
    this._sizer = null;
    this._animation = null;
    this._rafId = null;
  }

  connectedCallback() {
    this._render();
    this._initLoop();
    this._setupHoverPause();
  }

  _setupHoverPause() {
    this.addEventListener("mouseenter", () => {
      if (this.hasAttribute("hover-pause")) {
        this._animation?.pause();
      }
    });
    this.addEventListener("mouseleave", () => {
      if (this.hasAttribute("hover-pause")) {
        this._animation?.play();
      }
    });
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._mutationObserver?.disconnect();
    this._animation?.cancel();
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  attributeChangedCallback() {
    if (this._track) {
      this._lastTrackWidth = 0;
      this._updateLayout();
    }
  }

  get speed() {
    const speed = parseFloat(this.getAttribute("speed"));
    return isNaN(speed) ? 100 : speed;
  }

  get fill() {
    return this.hasAttribute("fill");
  }

  _render() {
    // 子要素を取得
    this._baseItems = Array.from(this.children);

    // サイズ維持用の要素（コンテナのサイズを決定する）
    this._sizer = document.createElement("div");
    this._sizer.className = "loop-sizer";
    Object.assign(this._sizer.style, {
      display: "flex",
      minWidth: "100%", // 子の%指定がコンテナ幅基準になるように
      visibility: "hidden",
    });

    // sizerにbaseItemsのクローンを追加（サイズ計算用）
    this._baseItems.forEach((item) => {
      const clone = item.cloneNode(true);
      // idの重複を防ぐ
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      this._sizer.appendChild(clone);
    });

    // トラック要素を作成（absoluteでコンテナサイズに影響しない）
    this._track = document.createElement("div");
    this._track.className = "loop-track";
    Object.assign(this._track.style, {
      position: "absolute",
      top: "0",
      left: "0",
      display: "flex",
      minWidth: "100%", // 子の%指定がコンテナ幅基準になるように
    });

    // 子要素をトラックに移動
    this._baseItems.forEach((item) => {
      item.dataset.baseItem = "true";
      this._track.appendChild(item);
    });

    // clone用のコンテナを作成
    this._cloneContainer = document.createElement("div");
    this._cloneContainer.className = "loop-clone";
    Object.assign(this._cloneContainer.style, {
      position: "absolute",
      top: "0",
      display: "flex",
    });
    this._track.appendChild(this._cloneContainer);

    // 要素を追加
    this.appendChild(this._sizer);
    this.appendChild(this._track);
  }

  _initLoop() {
    this._setupObservers();
    this._updateLayout();
  }

  _setupObservers() {
    // 既存のobserverをクリア
    this._resizeObserver?.disconnect();
    this._mutationObserver?.disconnect();

    // ResizeObserver
    this._resizeObserver = new ResizeObserver(() => {
      this._updateLayout();
    });

    this._baseItems.forEach((item) => {
      this._resizeObserver.observe(item);
    });
    this._resizeObserver.observe(this);

    // MutationObserver
    this._mutationObserver = new MutationObserver(() => {
      this._updateLayout();
    });

    this._baseItems.forEach((item) => {
      this._mutationObserver.observe(item, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
  }

  // クリックイベントをオリジナルにバイパスするヘルパー
  // 注意: cloneNode(true)はonclick属性はコピーするが、addEventListenerは コピーしない
  // onclick属性がある場合はバイパス不要
  _addClickBypass(clone, index) {
    if (clone.hasAttribute("onclick")) {
      return;
    }
    clone.addEventListener("click", (e) => {
      e.stopPropagation();
      this._baseItems[index % this._baseItems.length]?.click();
    });
  }

  _updateLayout() {
    if (!this._track || !this._cloneContainer || this._baseItems.length === 0) {
      return;
    }

    // 既存のrequestAnimationFrameをキャンセル
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }

    // 測定前にトラック幅をリセット
    this._track.style.width = "";

    // レイアウト更新を待ってから測定（2フレーム待つ）
    this._rafId = requestAnimationFrame(() => {
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        this._measureAndAnimate();
      });
    });
  }

  _measureAndAnimate() {
    if (!this._track || !this._cloneContainer || this._baseItems.length === 0) {
      return;
    }

    // sizerのクローンを更新（動的コンテンツ対応）
    this._sizer.innerHTML = "";
    this._baseItems.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      this._sizer.appendChild(clone);
    });

    // cloneをクリア
    this._cloneContainer.innerHTML = "";

    // cloneの位置をリセット
    this._cloneContainer.style.left = "0";

    // ベースアイテムの幅を計算
    let baseItemsWidth = 0;
    this._baseItems.forEach((item) => {
      const style = getComputedStyle(item);
      baseItemsWidth +=
        item.offsetWidth +
        parseFloat(style.marginLeft) +
        parseFloat(style.marginRight);
    });

    const containerWidth = this.clientWidth;
    const speed = this.speed;
    const isFillMode = this.fill;
    const isReverse = speed < 0;

    // fillクローンを削除してから再作成（点滅防止のため測定後に削除）
    this._track
      .querySelectorAll("[data-fill-clone]")
      .forEach((el) => el.remove());

    // fill mode: コンテナを埋めるまでアイテムを繰り返す
    if (isFillMode && baseItemsWidth < containerWidth) {
      const repeatCount = Math.ceil(containerWidth / baseItemsWidth);
      for (let r = 1; r < repeatCount; r++) {
        this._baseItems.forEach((item, index) => {
          const fillClone = item.cloneNode(true);
          fillClone.dataset.fillClone = "true";
          delete fillClone.dataset.baseItem;
          this._addClickBypass(fillClone, index);
          this._track.insertBefore(fillClone, this._cloneContainer);
        });
      }
    }

    // トラックの実際の幅を取得（fillクローン含む）
    const trackContentWidth = this._track.offsetWidth;
    // アニメーション用の幅（コンテナ幅かコンテンツ幅の大きい方）
    const trackWidth = Math.max(containerWidth, trackContentWidth);

    // 幅が変わっていなければスキップ
    if (trackWidth === this._lastTrackWidth) {
      // cloneだけ再作成
      const allItems = [
        ...this._baseItems,
        ...this._track.querySelectorAll("[data-fill-clone]"),
      ];
      allItems.forEach((item, index) => {
        const clone = item.cloneNode(true);
        // %指定を実際のpx値に変換（_cloneContainerはabsoluteで%が効かないため）
        clone.style.width = `${item.offsetWidth}px`;
        this._addClickBypass(clone, index);
        this._cloneContainer.appendChild(clone);
      });
      // cloneの位置を再設定
      this._cloneContainer.style.left = `${trackWidth}px`;
      return;
    }
    this._lastTrackWidth = trackWidth;

    // cloneを作成
    const allItems = [
      ...this._baseItems,
      ...this._track.querySelectorAll("[data-fill-clone]"),
    ];
    allItems.forEach((item, index) => {
      const clone = item.cloneNode(true);
      // %指定を実際のpx値に変換（_cloneContainerはabsoluteで%が効かないため）
      clone.style.width = `${item.offsetWidth}px`;
      this._addClickBypass(clone, index);
      this._cloneContainer.appendChild(clone);
    });

    // cloneの位置を設定（トラック幅の右端）
    this._cloneContainer.style.left = `${trackWidth}px`;

    // speed=0の場合はアニメーションをスキップ
    if (speed === 0) {
      this._animation?.cancel();
      this._animation = null;
      return;
    }

    // 現在のアニメーション進行率を保存
    let progress = 0;
    if (this._animation) {
      const currentTime = this._animation.currentTime ?? 0;
      const oldDuration = this._animation.effect?.getTiming().duration ?? 1;
      progress = (currentTime / oldDuration) % 1;
      this._animation.cancel();
    }

    // Web Animations APIでアニメーション設定（固定ピクセル値で移動）
    const duration = trackWidth / Math.abs(speed) * 1000; // ms
    this._animation = this._track.animate(
      [
        { transform: "translateX(0)" },
        { transform: `translateX(-${trackWidth}px)` },
      ],
      {
        duration,
        iterations: Infinity,
        easing: "linear",
        direction: isReverse ? "reverse" : "normal",
      }
    );

    // 進行率を復元
    this._animation.currentTime = progress * duration;
  }
}

customElements.define("loop-scroll", LoopScroll);
