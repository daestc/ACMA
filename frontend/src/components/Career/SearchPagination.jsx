function SearchPagination({ totalItems, currentPage, pageSize, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalItems <= pageSize) return null

  const startPage = Math.max(1, currentPage - 2)
  const endPage = Math.min(totalPages, startPage + 4)
  const pages = []
  for (let page = startPage; page <= endPage; page += 1) pages.push(page)

  return (
    <div className="career-search-pagination">
      <button type="button" className="career-page-btn" disabled={currentPage === 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>이전</button>
      {pages.map((page) => (
        <button key={page} type="button" className={`career-page-btn ${page === currentPage ? 'active' : ''}`} onClick={() => onPageChange(page)}>{page}</button>
      ))}
      <button type="button" className="career-page-btn" disabled={currentPage === totalPages} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}>다음</button>
    </div>
  )
}

export default SearchPagination
