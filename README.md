# statistics

访客统计采集脚本。零依赖单文件 IIFE，采集页面 PV/UV、滚动深度、停留时长与自定义事件，通过 `sendBeacon` 上报到 Laravel 服务端（`ForeignTrade/app/Http/Controllers/Api/Logs`）。

## 接入方式

```html
<script>
  window.__STATS_CONFIG = {
    endpoint: 'https://你的外网域名/api/logs/visitor.html',
    debug: false
  };
</script>
<script src="statistics.js"></script>
```

也可以用 data 属性，避免内联脚本：

```html
<script src="statistics.js"
        data-endpoint="https://你的外网域名/api/logs/visitor.html"></script>
```

`endpoint` 未配置时脚本会输出一条 `console.warn` 并停止，不会发起任何请求。地址优先级：`window.__STATS_CONFIG.endpoint` > `data-endpoint` > 文件顶部 `DEFAULT_ENDPOINT`。

## 自定义事件

```js
window.Stat.track('signup_click', { plan: 'pro', source: 'pricing' });
window.Stat.getVisitorId(); // 当前访客 ID
```

## 上报字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string | `pv` 浏览 / `ev` 自定义事件 / `stay` 停留离开 |
| `vid` | string | 访客 ID（localStorage 持久） |
| `sid` | string | 会话 ID（sessionStorage） |
| `url` | string | 当前完整 URL |
| `path` | string | pathname |
| `title` | string | 页面标题 |
| `ref` | string | referrer |
| `lang` | string | 浏览器语言 |
| `screen` | string | 屏幕分辨率，如 `1920x1080` |
| `tz` | string | IANA 时区 |
| `name` | string | 事件名（`ev`） |
| `props` | string | 事件属性 JSON（`ev`） |
| `dur` | int | 停留秒数（`stay`） |
| `scroll` | int | 最大滚动百分比 0-100（`stay`） |

访客 IP 由服务端 `$request->ip()` 记录，浏览器无法获取真实 IP。

## 本地验证

1. 在 `ForeignTrade` 项目执行 `php artisan serve`（默认 `http://127.0.0.1:8000`）。
2. 确认已建表：`php artisan migrate`（或按迁移文件手工建 `api_visitor_logs`）。
3. 用任意静态服务器打开本目录的 `demo.html`，滚动页面、点击「触发自定义事件」，然后切走页面。
4. 访问后台 `/logs/visitorLogs.html`（需服务端 IP 白名单）查看 PV / 事件 / 停留三类记录。

## 服务端部署

1. `php artisan migrate` 创建 `api_visitor_logs` 表。
2. 接口地址：`POST /api/logs/visitor.html`（`routes/api.php` 已注册）。
3. 将 `statistics.js` 上传到静态托管或站点 `public/` 目录，并按上面的方式引入到页面。
