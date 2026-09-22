# 部署指南（Docker）

本项目已经全部容器化，一条命令即可跑起来。下面按「先跑通 → 再答疑 → 最后上服务器」的顺序写。

---

## 一、前置条件

| 需要 | 说明 |
| --- | --- |
| Docker Desktop | Windows / macOS 装 Docker Desktop；Linux 装 docker + docker compose plugin |
| 端口 | `8088`（网页）、`3307`（MySQL 映射）没被占用，可在 `.env` 改 |
| 内存 | 建议给 Docker 分配 ≥ 4GB（MySQL 2G + 后端 512M + 前端几十 M） |

检查 Docker 是否就绪：

```bash
docker version          # 能看到 Server 段就说明引擎已启动
docker compose version  # 需要 v2，命令是 "docker compose"（中间有空格）
```

> 如果 `docker version` 只有 Client 没有 Server，说明 Docker Desktop 没启动，
> 打开它，等左下角变成 **Engine running** 再继续。

---

## 二、一键启动

Windows 双击 `start.bat`；Linux / macOS：

```bash
chmod +x start.sh && ./start.sh
```

等价的手动命令：

```bash
cd expense-tracker
docker compose up -d --build
```

看到 `Started` 之后访问 **http://localhost:8088** 。

### 启动过程发生了什么

1. `mysql` 容器拉取 `mysql:8.0` 镜像，创建数据库 `expense_tracker` 和用户 `ledger`，
   并执行 `deploy/mysql/init.sql` 建表（`docker-entrypoint-initdb.d` 机制，**只在数据卷为空时执行一次**）。
2. `backend` 容器用 `maven:3.9-eclipse-temurin-17` 编译出 jar，再拷进 `eclipse-temurin:17-jre-jammy` 运行。
   `depends_on: mysql: condition: service_healthy` 保证它等 MySQL 健康检查通过后才启动。
3. `frontend` 容器用 `oven/bun:1-alpine` 打包 React，把 `dist/` 丢进 nginx，并由 nginx 反向代理 `/api/` 到 `backend:8080`。

因为前端和后端走的是**同源**（都从 nginx 的 80 端口出去），所以生产环境不存在跨域问题。

### 验证是否成功

```bash
docker compose ps                    # 三个容器都应是 Up / healthy

# 后端接口
curl http://localhost:8088/api/health
# {"success":true,"message":"ok","data":{"status":"UP",...}}

# 前端页面
curl -I http://localhost:8088/
```

浏览器打开 http://localhost:8088 ，应能看到「记账本」页面。

---

## 三、验收操作（建议照着点一遍）

记账页默认显示「本月」，每条记录都归属到某个月。

1. **记一笔**：归属月份保持默认（本月）、支出名称填「吃」、详细填「（5+15）*30」、金额填 `960`，点「添加记录」。
   → 顶部合计立刻变成 `¥960.00`。
2. **加子项**：在「交通」这类需要拆细的条目上点右边的「＋」，填「地铁 / 通勤 / 120」。
   → 该条目变成父项，金额变成蓝色粗体（自动汇总），不可手填。
3. **再加一行**：继续给它加「单车 / 25」「公交 / 60」。
   → 父项金额自动变成 `205.00`，顶部合计同步重算。
   父项和子项的金额是**右对齐**的，数字对齐在同一条基准线上。
4. **按月批量生成**：点右上角「按月批量生成」，支出名称填「房租」，子项写 3200，
   月份选 2026-01 ~ 2026-12，点「生成记录」。
   → 一次生成 12 条（一个月一条）；再点一次会发现全部跳过（防重复）。
5. **改一行**：直接点表格里的金额数字（点一下变输入框，回车或点空白处生效），
   或改「支出详细」「归属月份」，合计立即重算。
   注意：有子项的父项金额是汇总值，不提供手填。
6. **看统计**：切到「统计」页 → 切「按月统计 / 按年统计」，
   看柱状图、累计趋势、饼图、按月明细表、名称排行是否随口径变化。
7. **看月份切换**：回记账页，把月份选择器清空 = 看全部月份；用「跳到已有月份」快速翻月。

> 旧版本（按天记录）升级上来的库不用手动处理，后端起容器时会自动迁移，见 README 第七节。

---

## 四、常用运维命令

```bash
# 看状态
docker compose ps

# 跟踪日志
docker compose logs -f              # 全部
docker compose logs -f backend      # 只看后端
docker compose logs --tail=200 backend

# 重启某个服务
docker compose restart backend

# 改完代码重新构建启动
docker compose up -d --build

# 只重新构建后端
docker compose up -d --build backend

# 停止（数据保留）
docker compose down

# 停止并清空数据（危险，会删库）
docker compose down -v

# 进入 MySQL 命令行
docker exec -it ledger-mysql mysql -uroot -p'ledger_root_pwd' expense_tracker
```

`docker compose down` **不会**删数据，数据存在命名卷 `ledger-mysql-data` 里，
下次 `up` 会接着用。

---

## 五、数据备份与恢复

**备份：**

```bash
docker exec ledger-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction expense_tracker' > backup_$(date +%Y%m%d).sql
```

Windows PowerShell 版：

```powershell
docker exec ledger-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction expense_tracker' | Out-File -Encoding utf8 backup.sql
```

**恢复：**

```bash
docker exec -i ledger-mysql mysql -uroot -p'ledger_root_pwd' expense_tracker < backup.sql
```

**导入可选的示例数据：**

```bash
docker exec -i ledger-mysql mysql -uroot -p'ledger_root_pwd' expense_tracker < deploy/mysql/demo-data.sql
```

---

## 六、常见问题

### 1. `docker compose up` 卡在拉取镜像 / 超时

国内网络拉 Docker Hub 可能很慢或失败（常见报错 `failed to copy: local error: tls: bad record MAC`）。
给 Docker Desktop 配一个镜像加速器：

**Docker Desktop → Settings → Docker Engine**，在 JSON 里加：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
```

保存后点 **Apply & Restart**。（镜像源可用性会变化，若某个失效请换一个。）

配好之后可以先把基础镜像拉下来，避免构建中途失败：

```bash
docker pull mysql:8.0
docker pull maven:3.9-eclipse-temurin-17
docker pull eclipse-temurin:17-jre-alpine
docker pull oven/bun:1-alpine
docker pull nginx:1.27-alpine
```

> 实测参考：本项目基础镜像合计约 2.2GB，网络通畅时首次构建 + 启动约 5~10 分钟；
> 网络较差时可能到 20 分钟以上，属正常现象，第二次构建有缓存会快很多。
> 若 `docker.m.daocloud.io` 在你的网络下更快，可只用它一个。

### 2. Maven 下载依赖慢 / 构建超时

`backend/maven-settings.xml` 里已经配好阿里云镜像，Dockerfile 用 `-s` 指定了它。
如果还是慢，可以换成公司内网 Nexus：

```xml
<mirror>
  <id>nexus</id>
  <url>http://your-nexus/repository/maven-public/</url>
  <mirrorOf>*</mirrorOf>
</mirror>
```

前端同理，`frontend/Dockerfile` 里用 `BUN_CONFIG_REGISTRY` 写死了 `registry.npmmirror.com`，可改成内网 registry。

### 3. 前端依赖安装失败

先把本地 `node_modules` 删掉再重建（`.dockerignore` 已经排除了它，正常不会进镜像）：

```bash
docker compose build --no-cache frontend
```

### 4. 端口被占用

`Bind for 0.0.0.0:8088 failed: port is already allocated`

改 `.env` 里的 `WEB_PORT`（比如 `18088`），然后 `docker compose up -d`。
查谁占了端口（Windows）：`netstat -ano | findstr :8088`

### 5. 后端起不来，日志报 `Communications link failure`

MySQL 还没就绪。等 30 秒再看，或：

```bash
docker compose logs mysql | tail -30
docker compose restart backend
```

如果数据卷是旧版本 MySQL 建的（比如从 5.7 升级），需要重建：

```bash
docker compose down -v && docker compose up -d --build
```

### 6. 页面能打开但接口 502

后端挂了或健康检查没过：

```bash
docker compose ps
docker compose logs --tail=100 backend
```

最常见原因是数据库连不上，检查 `.env` 的 `MYSQL_USER` / `MYSQL_PASSWORD` 是否被改错。

### 7. 改完代码页面没变化

浏览器缓存。前端静态资源是 30 天强缓存，但文件名带 hash，正常刷新即可；
如果 index.html 被缓存，`Ctrl + F5` 强刷。

### 8. MySQL 首次启动初始化脚本没执行

`init.sql` 只在**数据卷为空**时执行。想强制重跑：

```bash
docker compose down -v && docker compose up -d
```

（后端 `ddl-auto=update` 也会自动建表，所以即使没执行脚本也能用。）

---

## 七、部署到服务器

1. 服务器装好 Docker 与 compose plugin。
2. 把整个 `expense-tracker/` 目录传上去（`scp -r` 或 git）。
3. 修改 `.env`：**务必改掉 `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD`**，`WEB_PORT` 按需。
4. `docker compose up -d --build`
5. 放行防火墙的 `WEB_PORT`。

### 加 HTTPS（可选）

最简做法：在宿主机再跑一个 nginx / Caddy 反代到 `127.0.0.1:8088`，由它签发证书。
或者把 compose 里 frontend 的 `ports` 改成 `127.0.0.1:8088:80`，只允许本机访问，避免直接暴露。

### 限制资源（可选）

在 `docker-compose.yml` 的 `mysql` 服务下加：

```yaml
    deploy:
      resources:
        limits:
          memory: 1g
```

后端同理，并把 `.env` 的 `JAVA_OPTS` 调小，例如 `-Xms128m -Xmx384m`。

---

## 八、不用 Docker 的部署方式

### 后端

```bash
cd backend && mvn clean package -DskipTests
java -jar target/expense-tracker-backend.jar \
  --spring.datasource.url="jdbc:mysql://127.0.0.1:3306/expense_tracker?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai" \
  --spring.datasource.username=root \
  --spring.datasource.password=你的密码
```

也可以用环境变量：`DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`。

### 前端

```bash
cd frontend && bun run build
```

把 `frontend/dist/` 拷到 nginx 的站点目录，并把 `frontend/nginx.conf` 里的
`proxy_pass http://backend:8080/api/;` 改成后端实际地址（例如 `http://127.0.0.1:8080/api/;`）。

---

## 九、docker-compose 里改了什么，怎么回退

- 想换 MySQL 版本：改 `docker-compose.yml` 里 `image: mysql:8.0` → `mysql:8.4`，
  然后 `docker compose down -v && docker compose up -d --build`（换版本必须清数据卷，否则数据目录不兼容）。
- 想换后端基础镜像：`backend/Dockerfile` 里 `eclipse-temurin:17-jre-jammy` 可换成 `-alpine`（体积更小）。
- 想彻底不用前端容器：直接 `bun run build` 后把 `dist` 挂到宿主机 nginx，
  并删掉 compose 里的 `frontend` 服务。
