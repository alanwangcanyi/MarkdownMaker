#!/bin/bash
# 双击生成 Markdown Maker 安装包 dmg
# 原理：把最新编译的 app 打成带拖拽安装布局的 dmg

cd "$(dirname "$0")"

APP_SRC="release/mac-arm64/Markdown Maker.app"
DMG="release/Markdown Maker-1.0.0.dmg"
STAGING="release/dmg-staging"

if [ ! -d "$APP_SRC" ]; then
  echo "错误：未找到 $APP_SRC，请先在 TRAE 里执行 npm run pack:app"
  exit 1
fi

echo "准备安装包内容..."
rm -rf "$STAGING"
mkdir -p "$STAGING"
ditto "$APP_SRC" "$STAGING/Markdown Maker.app"
ln -s /Applications "$STAGING/Applications"

rm -f "$DMG"
echo "生成 dmg（约10-20秒）..."
hdiutil create -volname "Markdown Maker" -srcfolder "$STAGING" -ov -format UDZO "$DMG"

rm -rf "$STAGING"

if [ -f "$DMG" ]; then
  echo ""
  echo "完成！dmg 位置："
  echo "$PWD/$DMG"
  echo ""
  echo "自动打开所在文件夹..."
  open -R "$DMG"
else
  echo "生成失败，请把上面的错误信息发给 TRAE 助手"
fi
