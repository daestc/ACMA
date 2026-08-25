import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useAuth } from '../../context/AuthContext'
import ChangePasswordModal from './ChangePasswordModal'
import WithdrawModal from './WithdrawModal'

function MyPageModal({ onClose }) {
  const { user: sessionUser, logout, refreshUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState(false)

  const [form, setForm] = useState({ studentId: '', university: '', major: '', grade: '1', enrollmentStatus: '재학' })
  const [saving, setSaving] = useState(false)

  const [showChangePw, setShowChangePw] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  const isStaff = sessionUser?.role === 'staff'

  useEffect(() => {
    let cancelled = false
    apiGet('/user/profile')
      .then(data => {
        if (cancelled || !data?.user) return
        setProfile(data.user)
        setForm({
          studentId: data.user.studentId || '',
          university: data.user.university || '',
          major: data.user.major || '',
          grade: String(data.user.grade || 1),
          enrollmentStatus: data.user.enrollmentStatus || '재학',
        })
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [])

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showChangePw) setShowChangePw(false)
        else if (showWithdraw) setShowWithdraw(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showChangePw, showWithdraw, onClose])

  const handleOpenChangePw = () => {
    if (sessionUser?.provider !== 'local') {
      window.alert('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.')
      return
    }
    setShowChangePw(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await apiPost('/user/updateProfile', form)
      if (result.success) {
        if (result.universityChanged && result.clearedLectureCount > 0) {
          window.alert(`프로필이 업데이트되었습니다.\n대학 변경으로 시간표 강의 ${result.clearedLectureCount}개가 삭제되었습니다.`)
        } else if (result.universityChanged) {
          window.alert('프로필이 업데이트되었습니다.\n대학 정보가 변경되어 기존 강의 시간표가 초기화되었습니다.')
        } else {
          window.alert('프로필이 성공적으로 업데이트되었습니다.')
        }
        await refreshUser()
        const refreshed = await apiGet('/user/profile')
        if (refreshed?.user) setProfile(refreshed.user)
      } else {
        window.alert('프로필 업데이트에 실패했습니다. 다시 시도해주세요.')
      }
    } catch {
      window.alert('프로필 업데이트 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const displayName = profile?.name ?? sessionUser?.name ?? ''
  const displayMeta = isStaff
    ? `${profile?.email ?? sessionUser?.email ?? ''} · 대학관계자`
    : `${profile?.university ?? ''} · ${profile?.major ?? ''} · ${profile?.studentId ?? ''}`

  return (
    <>
      <div
        onClick={handleOverlayClick}
        style={{ position: 'fixed', inset: 0, background: 'rgba(23,25,43,.5)', zIndex: 1000, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, width: 860, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', position: 'relative' }}>
          <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 10, borderRadius: '20px 20px 0 0' }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>👤 마이페이지</div>
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: 'var(--text2)' }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '24px 28px' }}>
            {loadError && <p style={{ color: 'var(--red)', marginBottom: 16 }}>프로필 정보를 가져오는데 실패했습니다.</p>}

            <div className="profile-header" style={{ marginBottom: 20 }}>
              <div className="profile-avatar-lg" id="profile-avatar">
                {displayName ? displayName[0] : ''}
                {!isStaff && <div className="avatar-edit">✏</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div className="profile-info">
                  <div className="name">{displayName}</div>
                  <div className="meta">{displayMeta}</div>
                </div>
              </div>
            </div>

            {isStaff ? (
              <div style={{ maxWidth: 480 }}>
                <div className="settings-section">
                  <h3>소속 정보</h3>
                  <div className="form-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>소속 대학</label>
                    <input className="input-field" style={{ width: '100%', background: 'var(--bg3)', color: 'var(--text2)' }} readOnly
                      value={profile?.university || '등록된 소속 대학 없음'} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5 }}>
                    대학관계자 계정은 소속 대학 정보를 직접 수정할 수 없습니다.
                  </p>
                </div>
                <div className="settings-section">
                  <h3>계정</h3>
                  <div className="settings-row">
                    <div><div className="settings-label">로그아웃</div><div className="settings-desc">현재 세션을 종료합니다</div></div>
                    <button className="btn btn-ghost btn-sm" onClick={logout}>로그아웃</button>
                  </div>
                  <div className="settings-row">
                    <div><div className="settings-label">계정 탈퇴</div><div className="settings-desc">모든 데이터가 삭제됩니다</div></div>
                    <button className="btn btn-sm" style={{ color: 'var(--red)', border: '1.5px solid #fecdd3', background: '#fff1f2' }} onClick={() => setShowWithdraw(true)}>탈퇴</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid-2">
                <div>
                  <div className="settings-section">
                    <h3>학사정보</h3>
                    <div className="form-group">
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>학번</label>
                      <input className="input-field" style={{ width: '100%' }} value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>대학</label>
                      <input className="input-field" style={{ width: '100%' }} value={form.university} onChange={e => setForm(f => ({ ...f, university: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>주전공-복수전공</label>
                      <input className="input-field" style={{ width: '100%' }} value={form.major} onChange={e => setForm(f => ({ ...f, major: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>학년</label>
                      <select className="input-field" style={{ width: '100%' }} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
                        <option value="1">1학년</option>
                        <option value="2">2학년</option>
                        <option value="3">3학년</option>
                        <option value="4">4학년</option>
                        <option value="5">5학년 이상</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>재학상태</label>
                      <select className="input-field" style={{ width: '100%' }} value={form.enrollmentStatus} onChange={e => setForm(f => ({ ...f, enrollmentStatus: e.target.value }))}>
                        <option>재학</option>
                        <option>휴학</option>
                        <option>졸업</option>
                      </select>
                    </div>
                    <button className="btn btn-accent btn-sm" onClick={handleSave} disabled={saving}>
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                  <div className="settings-section">
                    <h3>보안</h3>
                    <div className="settings-row">
                      <div><div className="settings-label">비밀번호 변경</div></div>
                      <button className="btn btn-ghost btn-sm" onClick={handleOpenChangePw}>변경</button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="settings-section">
                    <h3>계정</h3>
                    <div className="settings-row">
                      <div><div className="settings-label">로그아웃</div><div className="settings-desc">현재 세션을 종료합니다</div></div>
                      <button className="btn btn-ghost btn-sm" onClick={logout}>로그아웃</button>
                    </div>
                    <div className="settings-row">
                      <div><div className="settings-label">계정 탈퇴</div><div className="settings-desc">모든 데이터가 삭제됩니다</div></div>
                      <button className="btn btn-sm" style={{ color: 'var(--red)', border: '1.5px solid #fecdd3', background: '#fff1f2' }} onClick={() => setShowWithdraw(true)}>탈퇴</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {showWithdraw && <WithdrawModal provider={sessionUser?.provider} onClose={() => setShowWithdraw(false)} />}
    </>
  )
}

export default MyPageModal
