/**
 * 编译产物自动归档脚本
 *
 * 规则：
 * - 归档目录：20260506-MarkdownMaker-archive（项目建立日期-项目名称-archive）
 * - 产物命名：四位递增编号-打包日期-产品名，如 0001-20260824-MarkdownMaker.app
 * - 只保留最新 5 个版本，归档后自动删除更旧的
 *
 * 用法：npm run archive（在 npm run pack / electron-builder --dir 之后执行）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ARCHIVE_DIR = path.join(PROJECT_ROOT, '20260506-MarkdownMaker-archive');
const APP_SOURCE = path.join(PROJECT_ROOT, 'release', 'mac-arm64', 'Markdown Maker.app');

function getNextIndex() {
  if (!fs.existsSync(ARCHIVE_DIR)) return 1;
  const entries = fs.readdirSync(ARCHIVE_DIR);
  let max = 0;
  for (const name of entries) {
    const m = name.match(/^(\d{4})-/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function pad4(n) {
  return String(n).padStart(4, '0');
}

function main() {
  if (!fs.existsSync(APP_SOURCE)) {
    console.error('未找到编译产物：release/mac-arm64/Markdown Maker.app，请先打包');
    process.exit(1);
  }

  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  const index = getNextIndex();
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const destName = `${pad4(index)}-${dateStr}-MarkdownMaker.app`;
  const dest = path.join(ARCHIVE_DIR, destName);

  console.log(`归档中：${destName} ...`);
  // 必须用 ditto 复制 .app（保留符号链接/权限/元数据，cpSync 会损坏 bundle）
  execSync(`ditto "${APP_SOURCE}" "${dest}"`);
  console.log(`归档完成：${dest}`);

  pruneOldArchives();
}

/** 只保留最新 KEEP_COUNT 个归档版本，删除更旧的 */
function pruneOldArchives() {
  const KEEP_COUNT = 5;
  const entries = fs.readdirSync(ARCHIVE_DIR)
    .filter((name) => /^\d{4}-/.test(name))
    .sort();
  const toDelete = entries.slice(0, Math.max(0, entries.length - KEEP_COUNT));
  for (const name of toDelete) {
    fs.rmSync(path.join(ARCHIVE_DIR, name), { recursive: true, force: true });
    console.log(`已清理旧版本：${name}`);
  }
}

main();
