# 安装和使用说明
## 安装扩展：
打开Chrome浏览器，访问 chrome://extensions/

开启右上角的"开发者模式"

点击"加载已解压的扩展程序"

选择包含这些文件的文件夹

## 获取Cloudflare API凭据：

登录 Cloudflare Dashboard

进入 My Profile → API Tokens

点击 Create Token

使用 "Edit zone DNS" 模板或自定义权限

复制生成的 Token

##获取Zone ID：
在Cloudflare Dashboard选择你的域名

在右侧边栏找到 Zone ID

复制这个ID

## 使用扩展：
点击Chrome工具栏中的扩展图标

输入API Token和Zone ID

点击"保存设置"

点击"加载DNS记录"查看所有记录

可以添加、编辑或删除DNS记录
## 功能特点
✅ 查看所有DNS记录,不需要手动输入Zone ID

✅ 添加新的DNS记录（支持A、AAAA、CNAME、TXT、MX类型）

✅ 编辑现有记录

✅ 删除记录

✅ 支持Cloudflare代理设置

✅ 安全存储API凭据（使用Chrome本地存储）

✅ TTL设置

✅ 友好的用户界面

✅ 域名选择器：提供下拉菜单选择要管理的域名

✅ 记录搜索和筛选：可以按类型筛选或搜索特定记录

记住上次选择的域名
快速切换域名
更详细的确认对话框
自动刷新功能
