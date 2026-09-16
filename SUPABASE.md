# Supabase 初始化（托管服务）

博客前端继续部署在腾讯云，PostgreSQL、认证、Storage、Realtime 和 Edge Functions 由 Supabase 托管。无需在腾讯云另装 PostgreSQL，也无需为了连接托管项目运行 `supabase start`。

## 1. 创建项目

打开 https://supabase.com/dashboard，登录后选择 New project，创建或选择组织。

- 项目名称可以使用 `firefly-blog`。
- 数据库密码自行生成并保存在密码管理器，不填写到前端配置。
- 按主要访客位置选择区域；面向中国大陆访客可以先考虑 Singapore，并实际测试访问质量。
- 创建完成后，在项目 Connect 或 Data API/API Keys 页面找到 Project URL 和公开 API key。

前端可使用 `sb_publishable_...` publishable key，也可以使用旧版 `anon` key。当前项目环境变量名仍为 `PUBLIC_SUPABASE_ANON_KEY`，两者都可填入。不要填 `sb_secret_...`、`service_role`、数据库密码或 Supabase access token。

## 2. 初始化数据库、权限、Storage 和 Realtime

在项目 SQL Editor → New query 中粘贴本仓库 `supabase/schema.sql` 全文并运行。这份脚本适用于新项目，创建三张表及对应策略，并创建私有存储桶与 Realtime publication 配置；对本脚本创建的同名策略可以重复执行。

执行完成后检查：

| 位置 | 预期结果 |
| --- | --- |
| Table Editor | `profiles`、`blog_comments`、`user_files` 三张表 |
| 表权限 | 三张表均启用 RLS，并显示相应 policies |
| Storage | `user-uploads` 存储桶，Public 关闭 |
| Database → Publications | `supabase_realtime` 包含 `public.blog_comments` |

`user_files.user_id` 默认从当前认证用户获取，上传记录不会因为缺少用户 ID 而失败；RLS 仍校验用户只能创建属于自己的记录。若已经执行过上一版脚本，请重新运行更新后的脚本。

## 3. 配置邮箱认证和跳转

在 Authentication → URL Configuration 设置：

```text
Site URL:
https://bytefun.site/account/

Redirect URLs:
https://bytefun.site/account/
http://localhost:4321/account/
```

邮箱注册和 GitHub 登录均指定回到当前站点的 `/account/`。生产和本地地址都需要加入 Redirect URLs；Site URL 使用账户页作为默认回跳地址。

在 Authentication → Sign In / Providers（有些界面显示 Providers）启用 Email，允许新用户注册，并保留 Confirm email。

默认邮件服务主要用于测试，只能向项目组织成员的邮箱发信，发送量也受限。先用加入该 Supabase 组织的邮箱测试。开放访客注册前，在 Authentication 的 SMTP 设置中配置自己的邮件服务和经过验证的发信域名。详见 https://supabase.com/docs/guides/auth/auth-smtp 。

## 4. 配置 GitHub OAuth

1. 在 Supabase Authentication 的 GitHub provider 中复制 Callback URL。
2. 打开 https://github.com/settings/developers，选择 OAuth Apps → New OAuth App。
3. Homepage URL 填 `https://bytefun.site`。
4. Authorization callback URL 填 Supabase 提供的地址，通常为 `https://<project-ref>.supabase.co/auth/v1/callback`。
5. 把 GitHub 创建的 Client ID 和 Client Secret 填入 Supabase GitHub provider，启用并保存。

GitHub 回调到 Supabase 的 `/auth/v1/callback`；Supabase 完成认证后再跳到博客 `/account/`。这两个地址作用不同。Client Secret 只放在 Supabase provider 设置中。

## 5. 将项目连接到博客

在腾讯云 `/opt/firefly/.env` 或本地项目根目录 `.env` 填入公开配置：

```dotenv
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<publishable-key-or-legacy-anon-key>
```

这是 Astro 静态站点，环境变量会在构建时写入前端文件。保存 `.env` 后必须重新构建和发布，只重启 Nginx 不会生效。可以把 Project URL 和公开 key 提供给部署协作者，由其完成腾讯云配置和发布；不要提供管理员密钥。

启用后 `/account/` 显示认证和上传界面，文章页和留言板按现有代码启用 Supabase 评论。新项目必须执行 SQL 并完成下方的在线验收；编译检查不能替代登录、RLS 和实时订阅验证。

## 6. 部署 Edge Functions

在本地项目根目录执行（Project ref 是 Dashboard 项目地址中的标识，一般也出现在项目 URL 中）：

```bash
cd /Users/nightwind/aiWork/firefly/Firefly
pnpm dlx supabase login
pnpm dlx supabase functions deploy health --project-ref YOUR_PROJECT_REF
pnpm dlx supabase functions deploy create-upload-url --project-ref YOUR_PROJECT_REF
```

登录通过浏览器完成，不把 access token 粘贴到聊天或提交到 Git。命令会读取仓库中的 `supabase/config.toml`。

- `health` 是公开 GET 接口，检查数据库查询能否完成。
- `create-upload-url` 是 POST 接口。它在函数内部调用 `auth.getUser()` 验证 Authorization Bearer 用户令牌，只给当前用户的目录生成签名上传 token。网关的旧 JWT 检查关闭，以支持项目使用的新签名密钥；匿名请求仍会被函数拒绝。
- 托管 Edge Functions 默认提供项目环境变量。代码兼容新版公开/私有 key 字典及旧版 anon/service-role 变量，无需手动运行 `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`。详见 https://supabase.com/docs/guides/functions/secrets 。

部署后可以打开 `https://<project-ref>.supabase.co/functions/v1/health`。若数据库已初始化，预期返回 `ok: true` 和 `database: true`。账户页当前直接通过 Storage SDK 上传；签名上传函数是独立可调用的后端接口。

## 7. 联调验收

项目接入并重新发布后，分别验证邮箱确认登录、GitHub 登录、私有文件上传及 `user_files` 记录。打开两个浏览器窗口验证评论同步，并用两个测试账户确认无法访问或修改对方私有文件。最后检查 Edge Function 的未认证请求返回 401、已认证请求返回上传 token。
