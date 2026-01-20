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
  }

  connectedCallback() {
    this._render();
    this._initLoop();
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._mutationObserver?.disconnect();
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

    // トラック要素を作成
    this._track = document.createElement("div");
    this._track.className = "loop-track";

    // 子要素をトラックに移動
    this._baseItems.forEach((item) => {
      item.dataset.baseItem = "true";
      this._track.appendChild(item);
    });

    // clone用のコンテナを作成
    this._cloneContainer = document.createElement("div");
    this._cloneContainer.className = "loop-clone";
    this._track.appendChild(this._cloneContainer);

    // トラックを追加
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

    // cloneをクリア
    this._cloneContainer.innerHTML = "";

    // fill用クローンを削除
    this._track
      .querySelectorAll("[data-fill-clone]")
      .forEach((el) => el.remove());

    this._track.style.width = "";

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

    // トラック幅を計算
    let trackWidth = baseItemsWidth;
    if (isFillMode && baseItemsWidth < containerWidth) {
      const repeatCount = Math.ceil(containerWidth / baseItemsWidth);
      // fill用クローンを追加
      for (let r = 1; r < repeatCount; r++) {
        this._baseItems.forEach((item, index) => {
          const fillClone = item.cloneNode(true);
          fillClone.dataset.fillClone = "true";
          delete fillClone.dataset.baseItem;
          this._addClickBypass(fillClone, index);
          this._track.insertBefore(fillClone, this._cloneContainer);
        });
      }
      trackWidth = baseItemsWidth * repeatCount;
    } else {
      trackWidth = Math.max(containerWidth, baseItemsWidth);
    }

    // 幅が変わっていなければスキップ
    if (trackWidth === this._lastTrackWidth) {
      // cloneだけ再作成
      const allItems = [
        ...this._baseItems,
        ...this._track.querySelectorAll("[data-fill-clone]"),
      ];
      allItems.forEach((item, index) => {
        const clone = item.cloneNode(true);
        this._addClickBypass(clone, index);
        this._cloneContainer.appendChild(clone);
      });
      this._track.style.width = `${trackWidth}px`;
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
      this._addClickBypass(clone, index);
      this._cloneContainer.appendChild(clone);
    });

    // スタイルを設定
    const duration = trackWidth / Math.abs(speed);
    this._track.style.width = `${trackWidth}px`;
    this._cloneContainer.style.left = `${trackWidth}px`;
    this._track.style.animationDuration = `${duration}s`;
    this._track.style.animationDirection = isReverse ? "reverse" : "normal";
  }
}

customElements.define("loop-scroll", LoopScroll);
