WidgetMetadata = {
  id: "live_clean_aggregate",
  title: "聚合直播LIVE",
  author: "Makkapakka",
  description: "虎牙、B站、Twitch等直播。",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://m.iill.top",
  
  modules: [
    {
      title: "精选频道",
      description: "自动分类：虎牙 / B站 / Twitch",
      requiresWebView: false,
      functionName: "loadFeaturedChannels",
      type: "list", 
      cacheDuration: 300, // 缓存5分钟
      params: []
    },
    {
      title: "自定义筛选",
      description: "输入关键词查找频道",
      requiresWebView: false,
      functionName: "searchChannels",
      type: "list",
      params: [
        {
          name: "keyword",
          title: "关键词",
          type: "input",
          description: "例如：电影、音乐、周杰伦",
          value: ""
        }
      ]
    }
  ]
};

// ===========================
// 配置区域
// ===========================

const M3U_SOURCE = "https://m.iill.top/Live.m3u";

// 🚫 需要屏蔽的分组名称 (完全匹配或包含)
const BLOCKED_GROUPS = [
  "免費訂閱", 
  "維護時間", 
  "維護內容", 
  "公告說明",
  "作者",
  "更新"
];

// ===========================
// 核心逻辑
// ===========================

// 1. 加载精选分类 (虎牙/B站/Twitch)
async function loadFeaturedChannels() {
  const allChannels = await fetchAndParseM3U();
  
  // 初始化容器
  const sections = [
    { title: "🐯 虎牙直播", items: [] },
    { title: "📺 哔哩哔哩", items: [] },
    { title: "👾 Twitch", items: [] }
  ];

  // 遍历所有频道进行归类
  for (const channel of allChannels) {
    const name = channel.title.toLowerCase();
    const group = (channel.group || "").toLowerCase();

    // 虎牙判断
    if (name.includes("虎牙") || group.includes("虎牙") || name.includes("huya")) {
      sections[0].items.push(channel);
      continue;
    }

    // B站判断
    if (name.includes("bilibili") || name.includes("b站") || name.includes("哔哩") || group.includes("bilibili")) {
      sections[1].items.push(channel);
      continue;
    }

    // Twitch判断
    if (name.includes("twitch") || group.includes("twitch")) {
      sections[2].items.push(channel);
      continue;
    }
  }

  // 过滤掉空的分组并构建返回格式
  const result = [];
  for (const sec of sections) {
    if (sec.items.length > 0) {
      result.push({
        title: `${sec.title} (${sec.items.length})`,
        type: "section", // 或者直接用 section 结构
        childItems: sec.items
      });
    }
  }
  
  // Forward 格式兼容：如果使用了 section 结构，直接返回数组即可
  // 如果 Forward 版本需要打平，可以在这里调整，通常 sections 结构是支持的
  return result.map(sec => ({
      title: sec.title,
      childItems: sec.childItems
  }));
}

// 2. 自定义关键词搜索
async function searchChannels(params) {
  const keyword = (params.keyword || "").trim().toLowerCase();
  if (!keyword) {
    return [{ title: "请输入关键词", type: "text" }];
  }

  const allChannels = await fetchAndParseM3U();
  const results = allChannels.filter(ch => 
    ch.title.toLowerCase().includes(keyword) || 
    (ch.group && ch.group.toLowerCase().includes(keyword))
  );

  if (results.length === 0) {
    return [{ title: "未找到相关频道", type: "text" }];
  }

  return [{
      title: `"${params.keyword}" 的搜索结果 (${results.length})`,
      childItems: results
  }];
}

// ===========================
// 工具函数：下载并解析 M3U
// ===========================

async function fetchAndParseM3U() {
  try {
    const res = await Widget.http.get(M3U_SOURCE);
    const text = res.body || res.data; // 兼容不同版本
    return parseM3U(text);
  } catch (e) {
    return [{ title: "获取源失败", subTitle: e.message, type: "text" }];
  }
}

function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  let currentInfo = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      // 解析信息行
      // 示例: #EXTINF:-1 tvg-logo="..." group-title="虎牙", 频道名
      
      // 1. 提取分组 (group-title)
      let group = "";
      const groupMatch = line.match(/group-title="([^"]*)"/);
      if (groupMatch) group = groupMatch[1];

      // 🛑 核心过滤：如果在屏蔽名单里，直接跳过
      if (isBlocked(group)) {
        currentInfo = null; // 标记为忽略
        continue;
      }

      // 2. 提取 Logo
      let logo = "";
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      if (logoMatch) logo = logoMatch[1];

      // 3. 提取名称 (逗号后面的部分)
      const nameParts = line.split(",");
      const title = nameParts[nameParts.length - 1].trim();

      currentInfo = {
        title: title,
        group: group,
        posterPath: logo
      };

    } else if (!line.startsWith("#")) {
      // 这是链接行
      if (currentInfo) {
        channels.push({
          id: line, //以此链接为ID
          title: currentInfo.title,
          subTitle: currentInfo.group || "直播频道",
          posterPath: currentInfo.posterPath,
          videoUrl: line,
          group: currentInfo.group,
          type: "tmdb", // 使用美观的卡片样式
          mediaType: "tv",
          playerType: "system"
        });
        currentInfo = null; // 重置
      }
    }
  }
  return channels;
}

// 检查是否在屏蔽名单中
function isBlocked(groupName) {
  if (!groupName) return false;
  for (const block of BLOCKED_GROUPS) {
    if (groupName.includes(block)) return true;
  }
  return false;
}
