WidgetMetadata = {
    id: "twitch_box_pro",
    title: "Twitch 关注列表",
    author: "Makkapakka",
    description: "专为 Twitch 设计。填入主播ID，实时显示封面，永久有效。",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    site: "https://www.twitch.tv",

    modules: [
        {
            title: "我的关注",
            functionName: "loadTwitchStreamers",
            type: "list",
            cacheDuration: 60, // 1分钟刷新一次封面
            params: [
                {
                    name: "streamers",
                    title: "主播 ID 列表",
                    type: "input",
                    description: "用英文逗号分隔，例如: uzi, shroud, tarik, tenz",
                    // 默认给你几个热门台做测试
                    value: "shroud, tarik, summit1g, tenz, kyedae"
                },
                {
                    name: "quality",
                    title: "封面质量",
                    type: "enumeration",
                    value: "large",
                    enumOptions: [
                        { title: "高清预览", value: "large" },
                        { title: "节省流量", value: "medium" }
                    ]
                }
            ]
        }
    ]
};

async function loadTwitchStreamers(params = {}) {
    const { streamers, quality } = params;

    if (!streamers) {
        return [{ id: "tip", type: "text", title: "请填写主播 ID" }];
    }

    // 处理输入的 ID 列表 (去空格，去空项)
    const idList = streamers.split(/[,，]/).map(s => s.trim()).filter(Boolean);

    if (idList.length === 0) {
        return [{ id: "empty", type: "text", title: "列表为空" }];
    }

    return idList.map(id => {
        // Twitch 官方封面 CDN 规则 (这是一个公开的魔法)
        // 只要这个主播在直播，这个链接就会显示实时画面
        // 如果不在直播，可能会显示 404 图或者旧图，但 Forward 会尝试加载
        const timestamp = new Date().getTime(); // 加时间戳防止缓存旧图
        const imgSize = quality === "large" ? "640x360" : "320x180";
        const posterUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}-${imgSize}.jpg?t=${timestamp}`;

        // 构造 Twitch 嵌入式播放器链接
        // parent=localhost 是绕过 Twitch 跨域限制的关键
        const playUrl = `https://player.twitch.tv/?channel=${id}&parent=localhost&muted=false`;

        return {
            id: `twitch_${id}`,
            // 使用 webview 模式，因为 Twitch 的 m3u8 有严格的 CORS 和 Token 验证
            // 原生播放器搞不定，用 WebView 嵌入是最稳的，相当于在 App 里开个小窗口看
            type: "webview", 
            
            url: playUrl,
            
            title: id.toUpperCase(),
            subTitle: "🟢 点击观看直播",
            posterPath: posterUrl,
            description: `频道: ${id}\n来源: Twitch Official`,
            
            // 额外配置：保持屏幕常亮等
            windowType: "safari", // 或者 "inapp" 看 Forward 支持哪种
            style: {
                // 如果 Forward 支持自定义宽高比，这里可以优化
                aspectRatio: 16/9
            }
        };
    });
}
