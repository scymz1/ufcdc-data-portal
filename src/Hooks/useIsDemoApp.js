import { useLocation } from "react-router-dom";

/**
 * Returns true if the demoMode query parameter is set to "true".
 */
const useIsDemoApp = () => {
  const { search } = useLocation(); // 获取 URL 的查询字符串部分
  const params = new URLSearchParams(search); // 使用 URLSearchParams 解析查询字符串
  const demoMode = params.get("demoMode"); // 获取 "demoMode" 参数
  return demoMode === "true";
};

export default useIsDemoApp;
