WidgetMetadata = {
    id: "tmdb_niche_genres",
    title: "设定控 | 趣味流派",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    description: "拒绝无聊分类！探索 赛博朋克/时空循环/克苏鲁/大逃杀 等特殊设定影视。",
    version: "1.0.1",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",

    // 0. 移除 apiKey，无需任何配置
    globalParams: [],

    modules: [
        {
            title: "探索流派",
            functionName: "loadNicheGenre",
            type: "list",
            cacheDuration: 3600,
            params: [
                {
                    name: "themeId",
                    title: "选择感兴趣的设定",
                    type: "enumeration",
                    value: "12190", 
                    enumOptions: [
                        { title: "🤖 赛博朋克 (Cyberpunk)", value: "12190" },
                        { title: "⏳ 时空循环 (Time Loop)", value: "4366|193382" },
                        { title: "🧟 丧尸围城 (Zombie)", value: "12377" },
                        { title: "🚀 太空歌剧 (Space Opera)", value: "3737" },
                        { title: "🔪 大逃杀/吃鸡 (Battle Royale)", value: "10565|263628" },
                        { title: "🐙 克苏鲁/洛夫克拉夫特 (Lovecraftian)", value: "210368" },
                        { title: "⚙️ 蒸汽朋克 (Steampunk)", value: "11105" },
                        { title: "🏚️ 末日废土 (Post-apocalyptic)", value: "2853" },
                        { title: "🕵️ 密室/本格推理 (Whodunit)", value: "10714" },
                        { title: "👻 伪纪录片 (Found Footage)", value: "10620" },
                        { title: "🦈 巨物恐惧 (Monster)", value: "4064" },
                        { title: "🧠 烧脑/心理惊悚 (Psychological)", value: "9919" },
                        { title: "🦄 黑暗奇幻 (Dark Fantasy)", value: "3205" }
                    ]
                },
                {
                    name: "mediaType",
                    title: "类型",
                    type: "enumeration",
                    value: "movie",
                    enumOptions: [
                        { title: "电影", value: "movie" },
                        { title: "剧集", value: "tv" }
                    ]
                },
                {
                    name: "sort",
                    title: "排序",
                    type: "enumeration",
                    value: "popularity.desc",
                    enumOptions: [
                        { title: "最热门", value: "popularity.desc" },
                        { title: "评分最高", value: "vote_average.desc" },
                        { title: "最新上映", value: "primary_release_date.desc" }
                    ]
                }
            ]
        }
    ]
};

// TMDB 全量类型映射
const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚",
    10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻",
    10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

async function loadNicheGenre(params = {}) {
    const { themeId, mediaType = "movie", sort = "popularity.desc" } = params;

    // 构造请求参数
    const queryParams = {
        language: "zh-CN",
        sort_by: sort,
        include_adult: false,
        include_video: false,
        page: 1,
        with_keywords: themeId,
        "vote_count.gte": 50 // 基础过滤
    };

    if (sort === "vote_average.desc") {
        queryParams["vote_count.gte"] = 300; // 高分榜门槛提高
    }

    // 修正排序字段兼容性
    if (mediaType === "tv" && sort.includes("primary_release_date")) {
        queryParams.sort_by = "first_air_date.desc";
    }

    try {
        // 使用 Widget.tmdb.get 免 Key 请求
        const res = await Widget.tmdb.get(`/discover/${mediaType}`, { params: queryParams });
        const data = res || {};
        
        if (!data.results || data.results.length === 0) {
            return [{ id: "empty", type: "text", title: "暂无数据", subTitle: "该分类下暂无内容" }];
        }

        // 映射数据
        return data.results.map(item => {
            const title = item.title || item.name;
            const originalName = item.original_title || item.original_name;
            const year = (item.release_date || item.first_air_date || "").substring(0, 4);
            const score = item.vote_average ? item.vote_average.toFixed(1) : "0.0";

            // 构造类型字符串
            const genreNames = (item.genre_ids || [])
                .map(id => GENRE_MAP[id])
                .filter(Boolean)
                .slice(0, 3)
                .join(" / ");

            return {
                id: String(item.id),
                tmdbId: parseInt(item.id),
                type: "tmdb",
                mediaType: mediaType,
                
                title: title,
                
                // 【核心 UI】年份 • 类型
                genreTitle: [year, genreNames].filter(Boolean).join(" • "),
                
                // 副标题：评分
                subTitle: `TMDB ${score}`,
                
                description: item.overview || `原名: ${originalName}`,
                
                posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
                backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
                
                rating: score,
                year: year
            };
        });

    } catch (e) {
        return [{ id: "err_net", type: "text", title: "网络错误", subTitle: e.message }];
    }
}
