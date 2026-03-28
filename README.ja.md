# Siglane

> Turn prompt chaos into control.

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![日本語](https://img.shields.io/badge/lang-日本語-green)](README.ja.md)

Siglane（シグレーン）は、画像生成AI向けのプロンプトを行単位で編集・整理・再利用できるWebツールです。

---

## Siglaneとは

画像生成AIのプロンプトは、カンマ区切りの長いテキストになりがちです。

```text
masterpiece, best quality, 1girl, smile, blue hair, (soft lighting:1.2)
```

Siglaneはこれを行単位に分解し、構造として扱えるようにします。

![Siglane screenshot](docs/screenshot.png)

プロンプトを「書く」から「操作する」へ。

---

## 機能

### MVPスコープ

- カンマ区切りプロンプトの自動分解
- 行単位の表示・編集
- ドラッグによる並べ替え
- 各行のON/OFF切り替え
- 重み付け（`(tag:1.2)` 形式）の手入力対応
- 再結合されたプロンプトの表示とワンクリックコピー
- メモ欄（seed、生成条件などの自由記述）
- 自動保存（localStorage）

### v2（予定）

- 辞書機能（プロンプトの登録・一覧・ワンクリック挿入）
- 重みスライダー
- JSONエクスポート / インポート
- ネガティブプロンプト管理

### 将来構想

- API連携による画像生成
- プロンプト履歴・差分比較
- ブラウザ拡張
- 外部ツール連携（ComfyUI / SD WebUI）

---

## コンセプト

Siglaneは単なるプロンプト整形ツールではなく、プロンプトを構造化された資産として扱うための環境です。

### 設計の優先順位

1. 編集しやすさ
2. 再利用（辞書）
3. 保存
4. 外部連携

### ゴール

- **MVP** — プロンプト編集が快適になる
- **v2** — プロンプトが再利用可能な資産になる
- **将来** — プロンプトの研究環境になる

---

## 想定ユースケース

- 長いプロンプトを要素ごとに整理したい
- 他人のプロンプトの構造を理解したい
- よく使うプロンプト要素を蓄積・再利用したい
- 試行錯誤のサイクルを高速に回したい

---

## 技術スタック

- React / Next.js
- TypeScript
- Tailwind CSS

---

## データ保存

- 初期：localStorageによる自動保存
- 補完：JSONエクスポート / インポート
- 将来：File System API / クラウド同期

---

## はじめかた

```bash
npm install
npm run dev
```

---

## 開発方針

- 小さく作って、すぐに使う
- 自分自身で使い倒し、不満を次の機能にする
- 過剰な設計やUIの作り込みを避ける

---

## ライセンス

MIT
