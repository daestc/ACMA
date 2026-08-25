function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-title">
          <strong>ACMA</strong>
          <span className="pilot-badge">React 파일럿</span>
        </div>
        <a className="ejs-link" href="/notice">
          기존 EJS 화면 보기
        </a>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}

export default Layout
