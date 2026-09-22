# ---------- Stage 1: 构建 ----------
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /build

# 使用项目自带的 Maven 配置（阿里云镜像），加速国内构建
COPY maven-settings.xml /build/maven-settings.xml

# 先只拷贝 pom，把依赖下载单独做成一层，后续改代码不会重复下载
COPY pom.xml /build/pom.xml
RUN mvn -s /build/maven-settings.xml -B -DskipTests dependency:go-offline || true

# 再拷贝源码进行真正的构建
COPY src /build/src
RUN mvn -s /build/maven-settings.xml -B -DskipTests clean package

# ---------- Stage 2: 运行 ----------
FROM eclipse-temurin:17-jre-alpine

ENV TZ=Asia/Shanghai \
    JAVA_OPTS="-Xms256m -Xmx512m -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai"

RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime 2>/dev/null || true

WORKDIR /app

COPY --from=build /build/target/expense-tracker-backend.jar /app/app.jar

EXPOSE 8080

# busybox wget 自带，无需额外安装
HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=15 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
