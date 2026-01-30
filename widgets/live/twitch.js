WidgetMetadata = {
    id: "twitch_native_v4",
    title: "Twitch 直播 (Pro)",
    author: "Makkapakka",
    description: "V4.0 终极修复：修正 User-Agent 以绕过 Cloudflare WAF 拦截，同时使用 TV 接口获取真实流地址。",
    version: "4.0.0",
    requiredVersion: "0.0.1",
    site: "https://www.twitch.tv",

    modules: [
        {
            title: "我的关注",
            functionName: "loadLiveStreams",
            type: "list",
            cacheDuration: 0, 
            params: [
                {
                    name: "streamers",
                    title: "主播 ID",
                    type: "input",
                    description: "输入ID (例: shaka, shroud, uzi)",
                    value: "shroud, tarik, tenz, zneptunelive, seoi1016"
                },
                {
                    name: "quality",
                    title: "画质优先",
                    type: "enumeration",
                    value: "chunked",
                    enumOptions: [
                        { title: "原画 (Source)", value: "chunked" },
                        { title: "720p60", value: "720p60" },
                        { title: "480p", value: "480p" }
                    ]
                }
            ]
        }
    ]
};

// 📺 Android TV 的 Client-ID (无需 Integrity Token)
const CLIENT_ID = "kd1unb4r3yd4jf6tbze5f7h6j197mw";

// 💻 电脑浏览器的 User-Agent (通过 WAF 的关键)
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function loadLiveStreams(params = {}) {
    const { streamers, quality } = params;
    if (!streamers) return [{ id: "tip", type: "text", title: "请填写主播 ID" }];

    const channelNames = streamers.split(/[,，]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    
    // 构造请求头：混合伪装
    const headers = {
        "Client-ID": CLIENT_ID,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://www.twitch.tv",
        "Referer": "https://www.twitch.tv/"
    };

    const promises = channelNames.map(async (channel) => {
        try {
            // 1. 请求 GQL (获取 Token 和 直播信息)
            const gqlQuery = {
                operationName: "PlaybackAccessToken",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: "0828119ded1c1347796643485968c200c26939681ef14ad046379208eb2477e3"
                    }
                },
                variables: {
                    isLive: true,
                    login: channel,
                    isVod: false,
                    vodID: "",
                    playerType: "frontpage"
                }
            };

            const res = await Widget.http.post("https://gql.twitch.tv/gql", {
                headers: headers,
                body: JSON.stringify(gqlQuery)
            });

            // 🛡️ 错误防御：检查返回的是否为 HTML (Cloudflare 拦截页面)
            const resData = res.body || res.data;
            if (typeof resData === 'string' && resData.trim().startsWith('<')) {
                throw new Error("被防火墙拦截 (WAF Blocked)");
            }

            const body = JSON.parse(resData);
            const data = body.data;

            // 检查是否在线
            if (!data || !data.stream) {
                 return {
                    id: `off_${channel}`,
                    type: "text",
                    title: channel.toUpperCase(),
                    subTitle: "⚫️ 离线 / Offline",
                    description: "该主播未开播"
                };
            }

            // 2. 提取 Token 和 Sig
            const token = data.streamPlaybackAccessToken?.value;
            const sig = data.streamPlaybackAccessToken?.signature;

            if (!token || !sig) {
                throw new Error("无法获取播放令牌");
            }

            // 3. 构造 M3U8 链接
            const m3u8Url = `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?allow_source=true&allow_audio_only=true&allow_spectre=false&player=twitchweb&playlist_include_framerate=true&segment_preference=4&sig=${sig}&token=${token}`;

            // 4. 封面处理
            let poster = data.stream.previewImageURL; 
            if (poster) {
                poster = poster.replace("{width}", "640").replace("{height}", "360");
                poster += `?t=${Date.now()}`;
            }

            // 5. 返回结果 (视频流)
            return {
                id: `live_${channel}`,
                type: "url", 
                videoUrl: m3u8Url, // Forward 识别此字段调用系统播放器
                
                title: data.stream.broadcaster.displayName || channel,
                subTitle: `🔴 ${formatViewers(data.stream.viewersCount)} • ${data.stream.game?.name || "未知"}`,
                posterPath: poster,
                description: data.stream.title || "无标题",
                
                // 播放时也带上伪装 Header
                customHeaders: {
                    "User-Agent": USER_AGENT,
                    "Referer": "https://www.twitch.tv/"
                }
            };

        } catch (e) {
            console.log(`[TwitchError] ${channel}: ${e.message}`);
            // 出错时返回红色提示卡片
            return { 
                id: `err_${channel}`, 
                type: "text", 
                title: `${channel} 加载失败`, 
                subTitle: e.message.substring(0, 30) // 截取错误信息防止过长
            };
        }
    });

    const results = await Promise.all(promises);
    return results;
}

function formatViewers(num) {
    if (!num) return "0";
    if (num >= 10000) return (num / 10000).toFixed(1) + "万";
    return num.toString();
}
