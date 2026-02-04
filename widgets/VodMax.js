// 默认内置你的 GitHub 源地址
const DEFAULT_SOURCE_URL = "https://raw.githubusercontent.com/MakkaPakka518/ForwardWidgets/refs/heads/main/tv.json";

const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

WidgetMetadata = {
  id: "vod_fix",
  title: "VOD Stream (在线源修复版)",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.2.3",
  requiredVersion: "0.0.1",
  description: "聚合VOD资源，修复JSON解析问题",
  author: "MakkaPakka & 两块",
  site: "https://github.com/MakkaPakka518/ForwardWidgets",
  globalParams: [
    {
      name: "multiSource",
      title: "是否启用聚合搜索",
      type: "enumeration",
      enumOptions: [
        { title: "启用", value: "enabled" },
        { title: "禁用", value: "disabled" }
      ]
    },
    {
      name: "VodData",
      title: "源配置 (JSON/CSV内容 或 URL)",
      type: "input",
      value: DEFAULT_SOURCE_URL
    }
  ],
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      params: [],
    }
  ],
};

// --- 辅助工具函数 ---

const isM3U8Url = (url) => url?.toLowerCase().includes('m3u8') || false;

function extractSeasonInfo(seriesName) {
  if (!seriesName) return { baseName: seriesName, seasonNumber: 1 };
  const chineseMatch = seriesName.match(/第([一二三四五六七八九十\d]+)[季部]/);
  if (chineseMatch) {
    const val = chineseMatch[1];
    const seasonNum = CHINESE_NUM_MAP[val] || parseInt(val) || 1;
    const baseName = seriesName.replace(/第[一二三四五六七八九十\d]+[季部]/, '').trim();
    return { baseName, seasonNumber: seasonNum };
  }
  const digitMatch = seriesName.match(/(.+?)(\d+)$/);
  if (digitMatch) {
    return { baseName: digitMatch[1].trim(), seasonNumber: parseInt(digitMatch[2]) || 1 };
  }
  return { baseName: seriesName.trim(), seasonNumber: 1 };
}

function extractPlayInfoForCache(item, siteTitle, type) {
  const { vod_name, vod_play_url, vod_play_from, vod_remarks = '' } = item;
  if (!vod_name || !vod_play_url) return [];

  const playSources = vod_play_url.replace(/#+$/, '').split('$$$');
  const sourceNames = (vod_play_from || '').split('$$$');
  
  return playSources.flatMap((playSource, i) => {
    const sourceName = sourceNames[i] || '默认源';
    const isTV = playSource.includes('#');
    const results = [];

    if (type === 'tv' && isTV) {
      const episodes = playSource.split('#').filter(Boolean);
      episodes.forEach(ep => {
        const [epName, url] = ep.split('$');
        if (url && isM3U8Url(url)) {
          const epMatch = epName.match(/第(\d+)集/);
          results.push({
            name: siteTitle,
            description: `${vod_name} - ${epName}${vod_remarks ? ' - ' + vod_remarks : ''} - [${sourceName}]`,
            url: url.trim(),
            _ep: epMatch ? parseInt(epMatch[1]) : null
          });
        }
      });
    } else if (type === 'movie' && !isTV) {
      const firstM3U8 = playSource.split('#').find(v => isM3U8Url(v.split('$')[1]));
      if (firstM3U8) {
        const [quality, url] = firstM3U8.split('$');
        const qualityText = quality.toLowerCase().includes('tc') ? '抢先版' : '正片';
        results.push({
          name: siteTitle,
          description: `${vod_name} - ${qualityText} - [${sourceName}]`,
          url: url.trim()
        });
      }
    }
    return results;
  });
}

// 核心修复：更健壮的源解析逻辑
function parseResourceSites(content) {
  let list = [];
  
  // 1. 如果是字符串，尝试解析 JSON 或处理 CSV
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        content = JSON.parse(trimmed); // 变成对象处理
      } catch (e) {
        // 解析失败，可能是CSV
      }
    }
    
    // 如果依然是字符串，按CSV处理
    if (typeof content === 'string') {
      return trimmed.split('\n').map(line => {
        const [title, value] = line.split(',').map(s => s.trim());
        if (title && value?.startsWith('http')) {
          return { title, value: value.endsWith('/') ? value : value + '/' };
        }
        return null;
      }).filter(Boolean);
    }
  }

  // 2. 如果是对象/数组 (可能是直接传入，也可能是 parse 出来的)
  if (typeof content === 'object' && content !== null) {
    if (Array.isArray(content)) {
      list = content;
    } else if (content.sites && Array.isArray(content.sites)) {
      // 兼容 TVBox 配置格式: { "sites": [...] }
      list = content.sites;
    } else if (content.data && Array.isArray(content.data)) {
      list = content.data;
    } else if (content.list && Array.isArray(content.list)) {
      list = content.list;
    }
  }

  // 3. 映射字段 (兼容 api, url, value 等多种写法)
  return list.map(s => ({ 
      title: s.key || s.name || s.title, 
      value: s.api || s.url || s.value 
  })).filter(s => s.title && s.value);
}

// --- 主入口函数 ---

async function loadResource(params) {
  const { seriesName, type = 'tv', season, episode, multiSource, VodData } = params;
  
  if (multiSource !== "enabled" || !seriesName) return [];

  // 1. 获取源配置
  let rawSourceData = VodData;
  
  if (rawSourceData && rawSourceData.trim().startsWith("http")) {
      try {
          const res = await Widget.http.get(rawSourceData.trim());
          // 注意：res.data 可能是 JSON 对象，也可能是 JSON 字符串，parseResourceSites 会自动处理
          rawSourceData = res.data; 
      } catch (e) {
          console.error("在线源下载失败");
          return [];
      }
  }

  const resourceSites = parseResourceSites(rawSourceData);
  if (resourceSites.length === 0) {
      console.log("未解析到任何有效源，请检查 JSON 格式");
      return []; 
  }

  const { baseName, seasonNumber } = extractSeasonInfo(seriesName);
  const targetSeason = season ? parseInt(season) : seasonNumber;
  const targetEpisode = episode ? parseInt(episode) : null;

  // 2. 尝试从缓存获取
  const cacheKey = `vod_exact_v2_${baseName}_s${targetSeason}_${type}`;
  let allResources = [];
  
  try {
    const cached = Widget.storage.get(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log(`命中缓存: ${cacheKey}`);
      allResources = cached;
    }
  } catch (e) {}

  // 3. 网络请求
  if (allResources.length === 0) {
    const fetchTasks = resourceSites.map(async (site) => {
      try {
        const response = await Widget.http.get(site.value, {
          params: { ac: "detail", wd: baseName.trim() },
          timeout: 8000 
        });
        const list = response?.data?.list;
        if (!Array.isArray(list)) return [];

        return list.flatMap(item => {
          const itemInfo = extractSeasonInfo(item.vod_name);
          
          // 精确匹配逻辑
          if (itemInfo.baseName !== baseName || itemInfo.seasonNumber !== targetSeason) {
            return [];
          }
          
          return extractPlayInfoForCache(item, site.title, type);
        });
      } catch (error) {
        return [];
      }
    });

    const results = await Promise.all(fetchTasks);
    const merged = results.flat();

    // 去重
    const urlSet = new Set();
    allResources = merged.filter(res => {
      if (urlSet.has(res.url)) return false;
      urlSet.add(res.url);
      return true;
    });

    if (allResources.length > 0) {
      try { Widget.storage.set(cacheKey, allResources, 10800); } catch (e) {}
    }
  }

  // 4. 结果返回
  if (type === 'tv' && targetEpisode !== null) {
    return allResources.filter(res => {
      if (res._ep !== undefined && res._ep !== null) {
        return res._ep === targetEpisode;
      }
      return res.description.includes(`第${targetEpisode}集`);
    });
  }

  return allResources;
}
