export function LibrarySkeleton() {
  return (
    <section className="library-grid" aria-busy="true" aria-label="여행을 불러오는 중">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="library-card library-card--skeleton">
          <div className="library-card__cover" />
          <div className="library-card__body">
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </section>
  );
}
