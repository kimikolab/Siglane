// ComfyUI PNG メタデータ解析ユーティリティ
// PNGのtEXtチャンクに埋め込まれたworkflow/promptJSONを抽出する

export interface ComfyPngMetadata {
  workflow: unknown | null; // UI形式ワークフロー
  prompt: unknown | null;   // API形式プロンプト
}

/**
 * PNGファイルのtEXtチャンクを解析してComfyUIメタデータを抽出する
 * ComfyUIはworkflowとpromptをtEXtチャンクのキーとして埋め込む
 */
export async function extractComfyPngMetadata(
  file: File,
): Promise<ComfyPngMetadata> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // PNGシグネチャ確認 (8 bytes)
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Not a valid PNG file");
    }
  }

  const result: ComfyPngMetadata = { workflow: null, prompt: null };
  let offset = 8;

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break;

    // チャンク長 (4 bytes, big-endian)
    const length = readUint32BE(bytes, offset);
    offset += 4;

    // チャンクタイプ (4 bytes ASCII)
    const type = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    offset += 4;

    if (type === "tEXt" || type === "iTXt") {
      const chunkData = bytes.slice(offset, offset + length);
      const parsed = parseTextChunk(chunkData, type);
      if (parsed) {
        const { key, value } = parsed;
        if (key === "workflow") {
          try {
            result.workflow = JSON.parse(value);
          } catch {
            /* ignore */
          }
        } else if (key === "prompt") {
          try {
            result.prompt = JSON.parse(value);
          } catch {
            /* ignore */
          }
        }
      }
    }

    if (type === "IEND") break;
    offset += length + 4; // data + CRC
  }

  return result;
}

/**
 * tEXt/iTXtチャンクのデータをkey/valueに分解する
 * tEXt: keyword\0text (Latin-1)
 * iTXt: keyword\0flag\0method\0lang\0translated\0text (UTF-8)
 */
function parseTextChunk(
  data: Uint8Array,
  type: string,
): { key: string; value: string } | null {
  const nullIdx = data.indexOf(0);
  if (nullIdx < 0) return null;

  const key = new TextDecoder("latin1").decode(data.slice(0, nullIdx));

  if (type === "tEXt") {
    const value = new TextDecoder("latin1").decode(data.slice(nullIdx + 1));
    return { key, value };
  } else {
    // iTXt: nullIdx+1=compression flag, +2=method, then lang\0translated\0text
    let pos = nullIdx + 3;
    const lang0 = data.indexOf(0, pos);
    if (lang0 < 0) return null;
    pos = lang0 + 1;
    const trans0 = data.indexOf(0, pos);
    if (trans0 < 0) return null;
    pos = trans0 + 1;
    const value = new TextDecoder("utf-8").decode(data.slice(pos));
    return { key, value };
  }
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

/**
 * 画像ファイルからサムネイル（base64 dataURL）を生成する
 * デフォルト最大256px、JPEGで圧縮
 */
export async function generateThumbnail(
  file: File,
  maxSize = 256,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * URLから画像を取得してサムネイル（base64 dataURL）を生成する
 * ComfyUI生成履歴のimageUrls（/view?filename=...）から永続化サムネイルを作成するために使用
 */
export async function generateThumbnailFromUrl(
  imageUrl: string,
  maxSize = 256,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
}
