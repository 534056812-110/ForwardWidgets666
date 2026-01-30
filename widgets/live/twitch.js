WidgetMetadata = {
    id: "twitch_native_player",
    title: "Twitch 原生播放",
    author: "Makkapakka",
    description: "真正实现在 Forward 内部直接播放。自动获取真实 M3U8 直播流，无需跳转。",
    version: "2.0.0",
    requiredVersion: "0.0.1",
    site: "https://www.twitch.tv",
    
    modules: [
        {
            title: "正在直播",
            functionName: "loadLiveStreams",
            type: "list",
            cacheDuration: 0, // 直播需要实时性，不缓存
            params: [
                {
                    name: "streamers",
                    title: "主播 ID 列表",
                    type: "input",
                    description: "输入ID，用逗号分隔 (例: uzi, shroud)",
                    value: "shroud, tarik, tenz, zneptunelive, seoi1016"
                },
                {
                    name: "quality",
                    title: "画质偏好",
                    type: "enumeration",
                    value: "chunked",
                    enumOptions: [
                        { title: "原画 (Source)", value: "chunked" },
                        { title: "高清 (720p60)", value: "720p60" },
                        { title: "流畅 (480p)", value: "480p" }
                    ]
                }
            ]
        }
    ]
};

// Twitch 公用 Client-ID (来自官方 Web 播放器，长期有效)
const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

async function loadLiveStreams(params = {}) {
    const { streamers, quality } = params;
    if (!streamers) return [{ id: "tip", type: "text", title: "请先填写主播 ID" }];

    // 清理 ID 列表
    const channelNames = streamers.split(/[,，]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    if (channelNames.length === 0) return [{ id: "empty", type: "text", title: "列表为空" }];

    const items = [];

    // 并发请求所有主播的数据，提高加载速度
    // 我们需要通过 GQL 接口同时获取：1. 直播间信息(标题/封面) 2. 播放所需的 Token/Sig
    const promises = channelNames.map(async (channel) => {
        try {
            const streamData = await getStreamDataAndToken(channel);
            
            // 如果获取失败或者没在直播
            if (!streamData || !streamData.stream) {
                // 离线状态 (可选：如果你不想显示离线主播，可以直接 return null)
                return {
                    id: `offline_${channel}`,
                    type: "text",
                    title: channel.toUpperCase(),
                    subTitle: "⚫️ 当前离线 / Offline",
                    description: "该主播当前未在直播，请稍后再试。"
                };
            }

            // 获取到了直播信息，构造 m3u8 链接
            const { stream, token, sig } = streamData;
            
            // 构造 Usher API 链接 (这是获取真实 m3u8 的关键)
            // allow_source=true 允许获取原画
            // allow_audio_only=true 允许纯音频
            const m3u8Url = `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?allow_source=true&allow_audio_only=true&allow_spectre=true&player=twitchweb&playlist_include_framerate=true&segment_preference=4&sig=${sig}&token=${token}`;

            // 封面图处理 (替换分辨率占位符)
            let poster = stream.previewImageURL || "";
            poster = poster.replace("{width}", "640").replace("{height}", "360");

            return {
                id: `live_${channel}`,
                // 关键点：使用 url 类型并提供 videoUrl，Forward 会调用原生播放器
                type: "url", 
                
                // 视频流地址
                videoUrl: m3u8Url,
                
                title: stream.broadcaster.displayName || channel,
                subTitle: `🔴 ${stream.viewersCount.toLocaleString()} 人正在观看`,
                posterPath: poster,
                
                // 构造详细描述
                description: `【${stream.game ? stream.game.name : "未知游戏"}】\n${stream.title || "无标题"}\n\n主播: ${channel}\n画质: ${quality === "chunked" ? "原画" : quality}`,
                
                // 给播放器传递正确的 Referer，防止被 Twitch 拒绝
                customHeaders: {
                    "Referer": "https://www.twitch.tv/",
                    "Origin": "https://www.twitch.tv",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            };

        } catch (e) {
            console.error(`Error loading ${channel}: ${e.message}`);
            return { id: `err_${channel}`, type: "text", title: `${channel} 加载失败`, subTitle: e.message };
        }
    });

    // 等待所有请求完成
    const results = await Promise.all(promises);
    
    // 过滤掉 null (如果有的话) 并返回
    return results.filter(Boolean);
}

// 核心功能：调用 Twitch GQL 接口获取信息和 Token
async function getStreamDataAndToken(channel) {
    // 这是一个聚合查询，同时请求 StreamInfo 和 PlaybackAccessToken
    const query = {
        operationName: "PlaybackAccessToken_Template",
        query: `query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {
            stream(userLogin: $login) {
                id
                title
                viewersCount
                previewImageURL
                game {
                    name
                }
                broadcaster {
                    displayName
                    login
                }
            }
            streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {
                value
                signature
            }
        }`,
        variables: {
            isLive: true,
            login: channel,
            isVod: false,
            vodID: "",
            playerType: "site"
        }
    };

    const res = await Widget.http.post("https://gql.twitch.tv/gql", {
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Content-Type": "application/json",
            // 必须加上这个 Header，否则 GQL 会报错
            "X-Device-Id": "twitch-web-wall-mason", 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        },
        body: JSON.stringify(query)
    });

    const data = JSON.parse(res.body || res.data); // 兼容不同环境的返回格式

    if (!data.data) return null;

    return {
        stream: data.data.stream,
        token: data.data.streamPlaybackAccessToken?.value,
        sig: data.data.streamPlaybackAccessToken?.signature
    };
}
