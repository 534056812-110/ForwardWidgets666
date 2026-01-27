WidgetMetadata = {
  id: "gemini.trakt.lists.pro",
  title: "Trakt 精选片单 (社区版)",
  author: "Gemini",
  description: "探索 Trakt 社区点赞最高的优质片单 (如: 反转神作/IMDB Top250)",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "精选片单",
      functionName: "loadTraktList",
      type: "list",
      requiresWebView: false,
      params: [
        {
          name: "apiKey",
          title: "TMDB API Key (必填)",
          type: "input",
          description: "用于加载图片",
        },
        // 预设一些高质量片单
        {
          name: "presetList",
          title: "选择片单",
          type: "enumeration",
          value: "imdb250",
          enumOptions: [
            { title: "🎬 IMDB Top 250 (实时更新)", value: "imdb250" },
            { title: "🤯 烧脑反转神作 (Mindf*ck)", value: "mindfuck" },
            { title: "🌍 历届奥斯卡最佳影片", value: "oscars" },
            { title: "🤖 赛博朋克美学 (Cyberpunk)", value: "cyberpunk" },
            { title: "🧟 丧尸围城 (Zombie Best)", value: "zombies" },
            { title: "📺 Netflix 历年最佳剧集", value: "netflix_best" },
            { title: "🔍 自定义 (输入ID)", value: "custom" }
          ]
        },
        // 自定义输入 (格式: username/listid)
        {
          name: "customId",
          title: "自定义片单ID",
          type: "input",
          description: "格式: username/list-id (例: justin/123456)",
          belongTo: {
            paramName: "presetList",
            value: ["custom"]
          }
        },
        {
          name: "clientId",
          title: "Trakt Client ID",
          type: "input",
          description: "选填，防限流",
        }
      ]
    }
  ]
};

// 预设片单映射 (User Slug + List ID)
const PRESETS = {
    "imdb250": { user: "justin", id: "imdb-top-250-movies" },
    "mindfuck": { user: "linaspencer", id: "mindfuck" },
    "oscars": { user: "movistapp", id: "oscar-best-picture-winners" },
    "cyberpunk": { user: "zombie84", id: "cyberpunk" },
    "zombies": { user: "s33", id: "best-zombie-movies" },
    "netflix_best": { user: "benj", id: "best-netflix-original-series" }
};

async function loadTraktList(params = {}) {
    const apiKey = params.apiKey;
    const clientId = params.clientId || "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

    if (!apiKey) return [{ id: "err", title: "❌ 请填写 API Key", type: "text" }];

    // 1. 确定片单信息
    let userSlug = "";
    let listId = "";

    if (params.presetList === "custom") {
        const input = params.customId; // "justin/imdb-top-250"
        if (!input || !input.includes("/")) {
            return [{ id: "err_fmt", title: "格式错误", subTitle: "请按 '用户名/片单ID' 格式填写", type: "text" }];
        }
        const parts = input.split("/");
        userSlug = parts[0];
        listId = parts[1];
    } else {
        const preset = PRESETS[params.presetList || "imdb250"];
        userSlug = preset.user;
        listId = preset.id;
    }

    // 2. 获取片单内容
    // 接口: users/{username}/lists/{id}/items
    console.log(`[Trakt] Fetching List: ${userSlug}/${listId}`);
    
    // 我们限制取前 20 个，防止请求过多
    const url = `https://api.trakt.tv/users/${userSlug}/lists/${listId}/items?limit=20`;
    
    try {
        const res = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": clientId
            }
        });

        const data = res.data || res;
        
        if (!Array.isArray(data)) {
            return [{ id: "err_trakt", title: "Trakt 连接失败", subTitle: "片单不存在或私密", type: "text" }];
        }

        // 3. 并发转译 TMDB
        const promises = data.map(async (item, index) => {
            const subject = item.show || item.movie;
            if (!subject || !subject.ids.tmdb) return null;

            // 确定类型
            const type = item.type === "show" ? "tv" : "movie";
            
            // 获取详情
            return await fetchTmdbDetail(subject.ids.tmdb, type, apiKey, index + 1, subject.title);
        });

        const results = await Promise.all(promises);
        return results.filter(r => r !== null);

    } catch (e) {
        return [{ id: "err_net", title: "网络错误", subTitle: e.message, type: "text" }];
    }
}

// ==========================================
// 辅助工具
// ==========================================
async function fetchTmdbDetail(id, type, apiKey, rank, originalTitle) {
    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&language=zh-CN`;
    try {
        const res = await Widget.http.get(url);
        const data = res.data || res;
        
        if (!data || !data.id) return null;

        return {
            id: String(data.id),
            tmdbId: parseInt(data.id),
            type: "tmdb",
            mediaType: type,
            
            title: `${rank}. ${data.name || data.title}`,
            subTitle: data.original_name || data.original_title || "",
            
            posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
            backdropPath: data.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : "",
            
            rating: data.vote_average ? data.vote_average.toFixed(1) : "0.0",
            year: (data.first_air_date || data.release_date || "").substring(0, 4),
            
            description: data.overview
        };
    } catch (e) {
        // 降级返回 (至少显示个标题)
        return {
            id: String(id),
            tmdbId: parseInt(id),
            type: "tmdb",
            mediaType: type,
            title: `${rank}. ${originalTitle}`,
            subTitle: "暂无中文元数据",
            posterPath: "",
            backdropPath: ""
        };
    }
}
