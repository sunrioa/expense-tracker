import Icon from './Icon';

/** 首次加载的占位：形状和真实内容一致，数据到了不会跳版 */
export function LedgerSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="正在加载">
      <div className="sk sk-label" />
      <div className="sk sk-hero" />
      <div className="sk sk-meta" />
      <div className="card sk-card">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk-row">
            <div className="sk sk-dot" />
            <div className="sk sk-line" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
            <div className="sk sk-num" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="card empty">
      <p className="empty-title">加载失败</p>
      <p className="empty-text">{message || '网络好像断了'}。确认后端服务在运行后再试一次。</p>
      <div className="empty-actions">
        <button type="button" className="btn" onClick={onRetry}>
          <Icon name="refresh" size={16} />
          重试
        </button>
      </div>
    </div>
  );
}
