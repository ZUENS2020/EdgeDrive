"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="home-wrap">
      <div className="home-card">
        <h1>管理页渲染失败</h1>
        <p>{error.message || "未知错误"}</p>
        <p>
          <button className="btn btn-primary" type="button" onClick={() => reset()}>
            重试
          </button>{" "}
          <a className="btn" href="/admin">
            强制刷新
          </a>
        </p>
      </div>
    </div>
  );
}
