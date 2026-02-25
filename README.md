# 天穹 · 飞机大战

一款简洁有品位的浏览器端飞机大战小游戏。

## 运行方式

用浏览器直接打开 `index.html` 即可，无需构建或服务器。

或本地起一个静态服务：

```bash
# 若已安装 Node
npx serve .

# 或 Python 3
python -m http.server 8080
```

然后访问 `http://localhost:8080`（或对应端口）。

## 操作说明

- **移动**：方向键 或 WASD  
- **射击**：空格  
- **暂停 / 继续**：P  

## 规则简述

- 击落敌机得分，不同敌机分数不同（小型快机 150、中型 100、重型 250）。
- 每 8 架敌机提升一关，敌机出现更频繁、略快。
- 共 3 条命，被敌机撞到会扣一条命并短暂无敌；命数为 0 时游戏结束。

## 部署到 Railway

1. 将本项目推送到 **GitHub**（若尚未推送，在项目目录执行 `git init`、`git add .`、`git commit -m "Initial"`，再在 GitHub 建仓并 `git remote add origin ...`、`git push -u origin main`）。
2. 打开 [railway.app](https://railway.app)，用 GitHub 登录。
3. 点击 **New Project** → **Deploy from GitHub repo**，选择本项目的仓库。
4. 选中生成的服务，进入 **Settings** → **Networking** → 点击 **Generate Domain**，得到公网访问地址。
5. Railway 会根据根目录的 `package.json` 自动执行 `npm install` 和 `npm start`（用 `serve` 提供静态文件），部署完成后用该地址即可访问游戏。

无需在 Railway 里改 Build / Start 命令，保持默认即可。

## 技术说明

- 纯前端：HTML5 Canvas + 原生 JavaScript + CSS
- 无依赖，单目录即可运行
- 实体与主循环分离（`entities.js` / `game.js`），便于扩展
