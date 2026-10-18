// 云服务对象配置（仅含可公开的前端字段，来自 workbuddy_cloud_service 返回的 publicConfig）
// 注意：endpoint / publishableKey 必须由 publicConfig 提供，不要手写或写死其他域名。
window.PUBLIC_CONFIG = {
  endpoint: "https://personal-site-15299.app.workbuddy.host",
  oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
  publishableKey: "wbpk_xP3HhgLwdJ6L8Mmtvo3uPB_7c97UJ73pl2VfVhk3nXNWYiCD8ahqHq3",
};

// 整个应用共用同一个 cloud 实例（Auth / Database / Storage / LLM 都走它）
// SDK 未加载时保持页面可用，登录区域会显示本地预览提示。
if (window.WorkBuddyCloud) {
  window.cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
    endpoint: window.PUBLIC_CONFIG.endpoint,
    oauthRelayBaseUrl: window.PUBLIC_CONFIG.oauthRelayBaseUrl,
    publishableKey: window.PUBLIC_CONFIG.publishableKey,
  });
} else {
  window.cloud = null;
  console.warn("WorkBuddy Cloud SDK 未加载，登录功能暂不可用。");
}
